import React from 'react';
import { View } from 'react-native';
// Named imports only — `import * as LucideIcons` would defeat tree-shaking
// and pull every icon (~1500) into the bundle. The map below is the closed
// set of icons referenced anywhere in the app.
import {
  Activity, AlarmClock, AlertCircle, AlertTriangle, Apple, ArrowLeft, ArrowRight,
  Award, BadgeInfo, BarChart3, Bell, Brain, Bug, Building2,
  Calendar, CalendarCheck, CalendarClock, CalendarPlus, CalendarX, Camera,
  Check, CheckCircle, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, ChevronsDown,
  CircleDot, ClipboardPenLine, Clock, Clock3, Coffee, Compass, Crown,
  ExternalLink, EyeOff, FlagOff, Flame, FlaskConical, Globe,
  Hand, Handshake, Hash, Heart, Home, Image as ImageIcon, Info,
  KeyRound, LampFloor, Lightbulb, List, Locate, Lock, LockKeyhole, LogIn, LogOut,
  Mail, Map, MapPin, Medal, Megaphone, MessageCircle, MessageSquare, Monitor, Moon, Move,
  Navigation, Pen, PenLine, Pencil, Plus,
  RefreshCw, Repeat, ScanLine, Search, Send, Settings, Share2, Shield, ShieldCheck, Sparkles, Star, Sun, Swords,
  Table2, Tag, Target, Timer, Trash2, TrendingUp, Trophy,
  User, UserCheck, UserPlus, UserRound, Users, Vote, WifiOff, X, XCircle, Zap,
  type LucideProps,
} from 'lucide-react-native';
import { lightColors } from '../theme';

interface IconProps {
  name: string;
  size?: number;
  color?: string;
  strokeWidth?: number;
}

const ICON_MAP: Record<string, React.ComponentType<LucideProps>> = {
  'activity': Activity,
  'alarm-clock': AlarmClock,
  'alert-circle': AlertCircle,
  'alert-triangle': AlertTriangle,
  'apple': Apple,
  'arrow-left': ArrowLeft,
  'arrow-right': ArrowRight,
  'award': Award,
  'badge-info': BadgeInfo,
  'bar-chart-3': BarChart3,
  'bell': Bell,
  'brain': Brain,
  'bug': Bug,
  'building-2': Building2,
  'calendar': Calendar,
  'calendar-check': CalendarCheck,
  'calendar-clock': CalendarClock,
  'calendar-plus': CalendarPlus,
  'calendar-x': CalendarX,
  'camera': Camera,
  'check': Check,
  'check-circle': CheckCircle,
  'chevron-down': ChevronDown,
  'chevron-left': ChevronLeft,
  'chevron-right': ChevronRight,
  'chevron-up': ChevronUp,
  'chevrons-down': ChevronsDown,
  'circle-dot': CircleDot,
  'clipboard-pen-line': ClipboardPenLine,
  'clock': Clock,
  'clock-3': Clock3,
  'coffee': Coffee,
  'compass': Compass,
  'crown': Crown,
  'external-link': ExternalLink,
  'eye-off': EyeOff,
  'flag-off': FlagOff,
  'flame': Flame,
  'flask-conical': FlaskConical,
  'globe': Globe,
  'hand': Hand,
  'handshake': Handshake,
  'hash': Hash,
  'heart': Heart,
  'home': Home,
  'image': ImageIcon,
  'info': Info,
  'key-round': KeyRound,
  'lamp-floor': LampFloor,
  'lightbulb': Lightbulb,
  'list': List,
  'locate': Locate,
  'lock': Lock,
  'lock-keyhole': LockKeyhole,
  'log-in': LogIn,
  'log-out': LogOut,
  'mail': Mail,
  'map': Map,
  'map-pin': MapPin,
  'medal': Medal,
  'megaphone': Megaphone,
  'message-circle': MessageCircle,
  'message-square': MessageSquare,
  'monitor': Monitor,
  'moon': Moon,
  'move': Move,
  'navigation': Navigation,
  'pen': Pen,
  'pen-line': PenLine,
  'pencil': Pencil,
  'plus': Plus,
  'refresh-cw': RefreshCw,
  'repeat': Repeat,
  'scan-line': ScanLine,
  'search': Search,
  'send': Send,
  'settings': Settings,
  'share-2': Share2,
  'shield': Shield,
  'shield-check': ShieldCheck,
  'sparkles': Sparkles,
  'star': Star,
  'sun': Sun,
  'swords': Swords,
  'table-2': Table2,
  'tag': Tag,
  'target': Target,
  'timer': Timer,
  'trash-2': Trash2,
  'trending-up': TrendingUp,
  'trophy': Trophy,
  'user': User,
  'user-check': UserCheck,
  'user-plus': UserPlus,
  'user-round': UserRound,
  'users': Users,
  'vote': Vote,
  'wifi-off': WifiOff,
  'x': X,
  'x-circle': XCircle,
  'zap': Zap,
};

export function Lucide({ name, size = 24, color = lightColors.text, strokeWidth }: IconProps) {
  const IconComponent = ICON_MAP[name];
  if (!IconComponent) {
    if (__DEV__) {
       
      console.warn(`[Icon] Missing entry in ICON_MAP for "${name}" — add it to src/components/Icon.tsx`);
    }
    return <View style={{ width: size, height: size }} />;
  }
  return <IconComponent size={size} color={color} strokeWidth={strokeWidth} />;
}
