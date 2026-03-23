import {
  Globe, Mail, BarChart3, Search, Calendar, StickyNote, Receipt,
  FileText, Coins, Briefcase, Users, Phone, Clock, Home, Play,
  Archive, ExternalLink, Bookmark, Mic, MapPin, Building2,
  TrendingUp, Lock, Image, Code, ShoppingCart, MessageSquare, Settings,
} from 'lucide-react';

type IconComponent = React.ComponentType<React.SVGProps<SVGSVGElement>>;

export const SHORTCUT_ICONS: Record<string, { icon: IconComponent; label: string }> = {
  Globe: { icon: Globe as unknown as IconComponent, label: 'Web' },
  Mail: { icon: Mail as unknown as IconComponent, label: 'E-mail' },
  Chart: { icon: BarChart3 as unknown as IconComponent, label: 'Grafikon' },
  Analytics: { icon: TrendingUp as unknown as IconComponent, label: 'Analitika' },
  Search: { icon: Search as unknown as IconComponent, label: 'Keresés' },
  Calendar: { icon: Calendar as unknown as IconComponent, label: 'Naptár' },
  Note: { icon: StickyNote as unknown as IconComponent, label: 'Jegyzet' },
  Invoice: { icon: Receipt as unknown as IconComponent, label: 'Számla' },
  FileText: { icon: FileText as unknown as IconComponent, label: 'Dokumentum' },
  Coins: { icon: Coins as unknown as IconComponent, label: 'Pénz' },
  Briefcase: { icon: Briefcase as unknown as IconComponent, label: 'Munka' },
  Users: { icon: Users as unknown as IconComponent, label: 'Csapat' },
  Phone: { icon: Phone as unknown as IconComponent, label: 'Telefon' },
  Clock: { icon: Clock as unknown as IconComponent, label: 'Idő' },
  Home: { icon: Home as unknown as IconComponent, label: 'Otthon' },
  Play: { icon: Play as unknown as IconComponent, label: 'Videó' },
  Archive: { icon: Archive as unknown as IconComponent, label: 'Archívum' },
  ExternalLink: { icon: ExternalLink as unknown as IconComponent, label: 'Link' },
  Bookmark: { icon: Bookmark as unknown as IconComponent, label: 'Könyvjelző' },
  Mic: { icon: Mic as unknown as IconComponent, label: 'Hang' },
  MapPin: { icon: MapPin as unknown as IconComponent, label: 'Térkép' },
  BuildingCommunity: { icon: Building2 as unknown as IconComponent, label: 'Építészet' },
  Lock: { icon: Lock as unknown as IconComponent, label: 'Biztonság' },
  Image: { icon: Image as unknown as IconComponent, label: 'Kép' },
  Script: { icon: Code as unknown as IconComponent, label: 'Kód' },
  ShoppingCart: { icon: ShoppingCart as unknown as IconComponent, label: 'Bolt' },
  MessageText: { icon: MessageSquare as unknown as IconComponent, label: 'Chat' },
  Settings2: { icon: Settings as unknown as IconComponent, label: 'Beállítások' },
};

const URL_ICON_RULES: Array<{ pattern: RegExp; icon: string }> = [
  { pattern: /mail|gmail|outlook|proton/i, icon: 'Mail' },
  { pattern: /chat|slack|discord|messenger|teams|telegram/i, icon: 'MessageText' },
  { pattern: /analytics|tracking|plausible|matomo/i, icon: 'Analytics' },
  { pattern: /chart|grafana|dashboard/i, icon: 'Chart' },
  { pattern: /calendar|cal\.|calendly/i, icon: 'Calendar' },
  { pattern: /invoice|billing|szamlazz|billingo/i, icon: 'Invoice' },
  { pattern: /bank|paypal|stripe|revolut|wise|transfer/i, icon: 'Coins' },
  { pattern: /drive|dropbox|cloud|storage|onedrive/i, icon: 'Archive' },
  { pattern: /docs|notion|document|confluence|wiki/i, icon: 'FileText' },
  { pattern: /note|evernote|obsidian|bear/i, icon: 'Note' },
  { pattern: /github|gitlab|bitbucket|code|codepen|repl/i, icon: 'Script' },
  { pattern: /youtube|vimeo|video|twitch|netflix/i, icon: 'Play' },
  { pattern: /podcast|spotify|music|soundcloud/i, icon: 'Mic' },
  { pattern: /map|maps|waze|earth/i, icon: 'MapPin' },
  { pattern: /phone|call|voip/i, icon: 'Phone' },
  { pattern: /shop|store|amazon|ebay|etsy|cart/i, icon: 'ShoppingCart' },
  { pattern: /search|google\.com\/?$/i, icon: 'Search' },
  { pattern: /photo|unsplash|pexels|imgur|figma|canva|design/i, icon: 'Image' },
  { pattern: /trello|jira|asana|linear|project|clickup/i, icon: 'Briefcase' },
  { pattern: /crm|hubspot|salesforce|client/i, icon: 'Users' },
  { pattern: /security|password|1password|bitwarden|lastpass/i, icon: 'Lock' },
  { pattern: /time|toggl|clockify|harvest/i, icon: 'Clock' },
];

export function guessIconFromUrl(url: string): string {
  for (const rule of URL_ICON_RULES) {
    if (rule.pattern.test(url)) return rule.icon;
  }
  return 'Globe';
}

export function getShortcutIcon(iconName: string | null | undefined): IconComponent {
  if (iconName && SHORTCUT_ICONS[iconName]) {
    return SHORTCUT_ICONS[iconName].icon;
  }
  return Globe as unknown as IconComponent;
}
