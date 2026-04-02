# Windows Code Signing Setup

## Overview

Windows SmartScreen flags unsigned applications as potentially harmful. To prevent this warning and establish trust with users, the Klient installer must be digitally signed with a valid code signing certificate.

## Why Code Signing is Required

- **User Trust**: Signed applications show your company name instead of "Unknown Publisher"
- **SmartScreen**: Prevents Windows Defender SmartScreen warnings
- **Download Safety**: Browsers are less likely to block signed executables
- **Professional Image**: Demonstrates legitimacy and security commitment

## Certificate Options

### Option 1: EV (Extended Validation) Code Signing Certificate (Recommended)

**Advantages:**
- Immediate SmartScreen reputation (no warnings from day 1)
- Highest level of trust
- Required for kernel-mode drivers

**Disadvantages:**
- More expensive ($300-500/year)
- Requires hardware token (USB key)
- Stricter validation process (2-5 days)

**Recommended Providers:**
- DigiCert (most popular)
- Sectigo (formerly Comodo)
- GlobalSign

### Option 2: Standard (OV) Code Signing Certificate

**Advantages:**
- Less expensive ($100-300/year)
- Faster validation (1-3 days)
- Can be stored in software

**Disadvantages:**
- Requires reputation building (SmartScreen warnings for ~6 months)
- Takes time to eliminate warnings completely

**Note:** Standard certificates will show SmartScreen warnings initially until Microsoft builds reputation for your certificate. This happens through download volume and user feedback over time.

## How to Obtain a Certificate

### Step 1: Choose a Certificate Authority

For Klient, recommended providers:
- **DigiCert** - Industry standard, good support
- **Sectigo/Comodo** - Budget-friendly option
- **SSL.com** - Good balance of price and features

### Step 2: Complete Validation

You'll need to provide:
- Business registration documents (Hungarian company registration)
- Tax ID (Adószám)
- Phone number and address verification
- Email verification (must be from company domain)
- For EV: Additional identity verification

### Step 3: Receive Certificate

**For EV Certificate:**
- Certificate arrives on USB hardware token
- Token must be inserted during build process

**For Standard Certificate:**
- Certificate arrives as `.pfx` or `.p12` file
- Protect this file with a strong password
- Store securely (treat like a password)

## Configuration

### Environment Variables

Set these environment variables for the build machine:

```bash
# Certificate file path (for standard OV certificates)
CSC_LINK=/path/to/certificate.pfx

# Certificate password
CSC_KEY_PASSWORD=your-certificate-password

# For EV certificates with hardware tokens
# Windows will automatically detect the token
# CSC_LINK is not needed
```

**Windows (PowerShell):**
```powershell
$env:CSC_LINK = "C:\path\to\certificate.pfx"
$env:CSC_KEY_PASSWORD = "your-password"
```

**Windows (Command Prompt):**
```cmd
set CSC_LINK=C:\path\to\certificate.pfx
set CSC_KEY_PASSWORD=your-password
```

### Security Best Practices

1. **Never commit certificates to git**
   - Added to `.gitignore`: `*.pfx`, `*.p12`

2. **Never commit passwords to git**
   - Use environment variables only
   - Consider using a secrets manager

3. **Limit access to certificates**
   - Only authorized personnel should have access
   - Consider using a CI/CD secrets vault

4. **Use strong passwords**
   - Minimum 12 characters
   - Mix of letters, numbers, symbols

## Build Configuration

The `package.json` build configuration now includes:

```json
{
  "win": {
    "icon": "assets/icon.ico",
    "target": "nsis",
    "certificateSubjectName": "Klient",
    "signingHashAlgorithms": ["sha256"],
    "signDlls": false
  }
}
```

**Options explained:**
- `certificateSubjectName`: Your company/app name (must match certificate)
- `signingHashAlgorithms`: Use SHA-256 (industry standard)
- `signDlls`: Usually false (signing DLLs is slow and often unnecessary)

**Automatic behavior:**
- If `CSC_LINK` is set → Signs executable automatically
- If `CSC_LINK` is not set → Skips signing (allows development builds)
- This means developers can build locally without a certificate

## Building with Code Signing

### Local Build (Development Machine)

1. Install your certificate:
   - For `.pfx`: Import to Windows Certificate Store (optional)
   - For EV token: Insert USB token

2. Set environment variables (see above)

3. Build the app:
   ```bash
   npm run dist
   ```

4. Verify signing:
   - Right-click the `.exe` in `release/` folder
   - Select "Properties" → "Digital Signatures" tab
   - Should show your certificate details

### CI/CD Build (GitHub Actions)

Add certificate as a secret:

1. Go to GitHub repository → Settings → Secrets
2. Add `WINDOWS_CERTIFICATE` (base64-encoded `.pfx` file)
3. Add `WINDOWS_CERTIFICATE_PASSWORD`

Example workflow:

```yaml
- name: Decode certificate
  run: |
    echo "${{ secrets.WINDOWS_CERTIFICATE }}" | base64 --decode > certificate.pfx

- name: Build and sign
  env:
    CSC_LINK: certificate.pfx
    CSC_KEY_PASSWORD: ${{ secrets.WINDOWS_CERTIFICATE_PASSWORD }}
  run: npm run dist

- name: Clean up certificate
  if: always()
  run: rm certificate.pfx
```

## Troubleshooting

### "Unable to find certificate" error

**Cause:** `CSC_LINK` not set or certificate file not found

**Solution:**
- Verify `CSC_LINK` points to correct file path
- Check file exists at that location
- For EV tokens, ensure token is inserted

### "Invalid certificate password" error

**Cause:** `CSC_KEY_PASSWORD` is incorrect

**Solution:**
- Verify password is correct
- Check for special characters that need escaping
- Try setting password without quotes

### SmartScreen still shows warnings (Standard certificate only)

**Cause:** Certificate reputation not yet established

**Solution:**
- This is normal for standard certificates
- Takes 6-12 months to build reputation
- Encourage users to click "More info" → "Run anyway"
- Consider upgrading to EV certificate for immediate trust

### "SignTool not found" error

**Cause:** Windows SDK not installed

**Solution:**
```bash
# Install Windows SDK (includes SignTool)
choco install windows-sdk-10.0
```

Or download from Microsoft: https://developer.microsoft.com/en-us/windows/downloads/windows-sdk/

## Cost Analysis

### EV Certificate: ~$400/year
**Pros:**
- No SmartScreen warnings
- Immediate trust
- Professional image

**ROI:** Reduced support burden, higher conversion rates

### Standard Certificate: ~$150/year
**Pros:**
- Lower cost
- Still provides identity verification

**Cons:**
- SmartScreen warnings for 6-12 months
- May hurt adoption in early stages

### Recommendation for Klient

Start with **EV certificate** because:
1. Klient is a business tool (trust is critical)
2. Early users won't face friction
3. Professional image from day 1
4. Cost is reasonable for business software

## Timeline

1. **Order certificate**: 1-2 days (standard) or 3-5 days (EV)
2. **Validation**: 1-3 days (standard) or 2-7 days (EV)
3. **Configuration**: 1-2 hours (one-time setup)
4. **First signed build**: ~10 minutes

**Total:** Plan for 1-2 weeks to get first signed build

## Next Steps

1. ☐ Choose certificate provider (DigiCert recommended for EV)
2. ☐ Order certificate (EV recommended)
3. ☐ Complete validation process
4. ☐ Receive certificate/token
5. ☐ Configure environment variables
6. ☐ Test local signed build
7. ☐ Configure CI/CD signing
8. ☐ Release signed version

## References

- [Electron Code Signing](https://www.electron.build/code-signing)
- [Microsoft SmartScreen](https://docs.microsoft.com/en-us/windows/security/threat-protection/microsoft-defender-smartscreen/)
- [DigiCert Code Signing](https://www.digicert.com/signing/code-signing-certificates)
