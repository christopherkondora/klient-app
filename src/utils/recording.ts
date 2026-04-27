/**
 * Audio recording utilities.
 *
 * Supports:
 *   - Microphone-only capture (works on all platforms).
 *   - Microphone + system audio capture (Windows only) — mixes both into a single
 *     MediaStream using the Web Audio API so the resulting recording contains
 *     both the local speaker's mic and any audio coming out of the speakers
 *     (e.g. the other party on a Google Meet / Teams call).
 *
 * macOS note: system audio capture is blocked by the OS and requires a virtual
 * audio device (e.g. BlackHole) to be installed. On macOS we transparently fall
 * back to microphone-only recording with a warning returned to the caller.
 */

export type RecordingStartOptions = {
  includeSystemAudio?: boolean;
};

export type RecordingSession = {
  stream: MediaStream;
  /** Called when the recorder is stopped so we tear down all inputs + audio graph. */
  stop: () => void;
  /** True if the resulting stream contains system audio. */
  systemAudioActive: boolean;
};

const isWindows = typeof navigator !== 'undefined' && /Win/i.test(navigator.platform);

async function getSystemAudioStream(): Promise<MediaStream | null> {
  try {
    // In Electron (with a DisplayMediaRequestHandler that returns `audio: 'loopback'`)
    // this call resolves silently without showing a picker and gives us the full
    // system audio loopback as an audio track. The video track is ignored.
    const displayStream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: true,
    });

    const audioTracks = displayStream.getAudioTracks();
    if (audioTracks.length === 0) {
      displayStream.getTracks().forEach((t) => t.stop());
      return null;
    }

    // We don't need the video — stop it immediately.
    displayStream.getVideoTracks().forEach((t) => t.stop());

    // Return a fresh stream with only the audio tracks.
    return new MediaStream(audioTracks);
  } catch (err) {
    console.warn('[recording] System audio capture failed:', err);
    return null;
  }
}

export async function startAudioRecording(
  options: RecordingStartOptions = {}
): Promise<RecordingSession> {
  const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });

  if (!options.includeSystemAudio) {
    return {
      stream: micStream,
      stop: () => micStream.getTracks().forEach((t) => t.stop()),
      systemAudioActive: false,
    };
  }

  if (!isWindows) {
    // macOS / Linux: bail out gracefully, keep mic-only.
    console.warn('[recording] System audio capture is only supported on Windows.');
    return {
      stream: micStream,
      stop: () => micStream.getTracks().forEach((t) => t.stop()),
      systemAudioActive: false,
    };
  }

  const systemStream = await getSystemAudioStream();
  if (!systemStream) {
    return {
      stream: micStream,
      stop: () => micStream.getTracks().forEach((t) => t.stop()),
      systemAudioActive: false,
    };
  }

  // Mix mic + system audio into a single MediaStream using Web Audio API.
  const audioContext = new AudioContext();
  const destination = audioContext.createMediaStreamDestination();

  const micSource = audioContext.createMediaStreamSource(micStream);
  const systemSource = audioContext.createMediaStreamSource(systemStream);

  const micGain = audioContext.createGain();
  const systemGain = audioContext.createGain();
  micGain.gain.value = 1.0;
  systemGain.gain.value = 1.0;

  micSource.connect(micGain).connect(destination);
  systemSource.connect(systemGain).connect(destination);

  const mixedStream = destination.stream;

  return {
    stream: mixedStream,
    stop: () => {
      try {
        micSource.disconnect();
        systemSource.disconnect();
        micGain.disconnect();
        systemGain.disconnect();
      } catch {
        /* noop */
      }
      micStream.getTracks().forEach((t) => t.stop());
      systemStream.getTracks().forEach((t) => t.stop());
      mixedStream.getTracks().forEach((t) => t.stop());
      audioContext.close().catch(() => { /* noop */ });
    },
    systemAudioActive: true,
  };
}

export function canCaptureSystemAudio(): boolean {
  return isWindows;
}
