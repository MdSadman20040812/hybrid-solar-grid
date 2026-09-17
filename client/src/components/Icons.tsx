import type { SVGProps } from 'react';

const base = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

export function SunIcon(props: SVGProps<SVGSVGElement>) {
  return <svg {...base} {...props}><circle cx="12" cy="12" r="3.5"/><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.65 17.65l1.42 1.42M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.65 6.35l1.42-1.42"/></svg>;
}
export function BatteryIcon(props: SVGProps<SVGSVGElement>) {
  return <svg {...base} {...props}><rect x="3" y="6" width="16" height="12" rx="2"/><path d="M21 10v4M7 12h8M11 8v8"/></svg>;
}
export function GridIcon(props: SVGProps<SVGSVGElement>) {
  return <svg {...base} {...props}><path d="m12 2-5 8h3l-3 12 10-13h-4l3-7z"/></svg>;
}
export function ShieldIcon(props: SVGProps<SVGSVGElement>) {
  return <svg {...base} {...props}><path d="M12 3 5 6v5c0 4.6 2.9 8.4 7 10 4.1-1.6 7-5.4 7-10V6z"/><path d="m9.2 12 1.8 1.8 3.9-4"/></svg>;
}
export function SignalIcon(props: SVGProps<SVGSVGElement>) {
  return <svg {...base} {...props}><path d="M5 16.5h.01M8.5 13a5 5 0 0 1 7 0M5.5 10a9 9 0 0 1 13 0M2.5 7a13 13 0 0 1 19 0"/></svg>;
}
export function SparkIcon(props: SVGProps<SVGSVGElement>) {
  return <svg {...base} {...props}><path d="m12 2 1.5 6.5L20 10l-6.5 1.5L12 18l-1.5-6.5L4 10l6.5-1.5z"/><path d="m19 16 .7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7z"/></svg>;
}
export function LockIcon(props: SVGProps<SVGSVGElement>) {
  return <svg {...base} {...props}><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/></svg>;
}
export function ArrowIcon(props: SVGProps<SVGSVGElement>) {
  return <svg {...base} {...props}><path d="M5 12h14M14 7l5 5-5 5"/></svg>;
}
export function ActivityIcon(props: SVGProps<SVGSVGElement>) {
  return <svg {...base} {...props}><path d="M3 12h4l2-7 4 14 2-7h6"/></svg>;
}
export function InfoIcon(props: SVGProps<SVGSVGElement>) {
  return <svg {...base} {...props}><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>;
}
export function AlertIcon(props: SVGProps<SVGSVGElement>) {
  return <svg {...base} {...props}><path d="M10.3 3.5 2.5 18a2 2 0 0 0 1.8 3h15.4a2 2 0 0 0 1.8-3L13.7 3.5a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/></svg>;
}
export function PowerIcon(props: SVGProps<SVGSVGElement>) {
  return <svg {...base} {...props}><path d="M12 2v10M6.4 5.6a8 8 0 1 0 11.2 0"/></svg>;
}
export function LeafIcon(props: SVGProps<SVGSVGElement>) {
  return <svg {...base} {...props}><path d="M11 20A7 7 0 0 1 4 13c0-7 8-9 16-9 0 8-2 16-9 16Z"/><path d="M2 22 11 13"/></svg>;
}
export function TrendIcon(props: SVGProps<SVGSVGElement>) {
  return <svg {...base} {...props}><path d="m3 17 6-6 4 4 8-8"/><path d="M14 7h7v7"/></svg>;
}
export function GaugeIcon(props: SVGProps<SVGSVGElement>) {
  return <svg {...base} {...props}><path d="M12 14 8 10"/><path d="m21 12a9 9 0 1 0-18 0"/><circle cx="12" cy="12" r="1.5"/></svg>;
}
export function ClockIcon(props: SVGProps<SVGSVGElement>) {
  return <svg {...base} {...props}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>;
}
export function BoltIcon(props: SVGProps<SVGSVGElement>) {
  return <svg {...base} {...props}><path d="m13 2-9 12h7l-1 8 9-12h-7z"/></svg>;
}
export function SearchIcon(props: SVGProps<SVGSVGElement>) {
  return <svg {...base} {...props}><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>;
}
export function CompassIcon(props: SVGProps<SVGSVGElement>) {
  return <svg {...base} {...props}><circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5z"/></svg>;
}
