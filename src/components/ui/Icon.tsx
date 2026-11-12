import type { SVGProps } from 'react'
const paths={
  book: 'M4 4h6a3 3 0 0 1 2 1 3 3 0 0 1 2-1h6v15h-6a3 3 0 0 0-2 1 3 3 0 0 0-2-1H4z M12 5v15',
  home: 'm3 10 9-7 9 7 M5 9v12h5v-7h4v7h5V9',
  compass: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0 M16 8l-3 5-5 3 3-5z',
  clipboard: 'M9 4H5v17h14V4h-4 M9 3h6v4H9z M8 12h8 M8 16h5',
  users: 'M16 21v-3a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v3 M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0 M17 3a4 4 0 0 1 0 8 M22 21v-3a4 4 0 0 0-3-4',
  user: 'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0 M4 21v-2a8 8 0 0 1 16 0v2',
  plus: 'M12 5v14 M5 12h14',
  arrow: 'M5 12h14 m-6-6 6 6-6 6',
  back: 'M19 12H5 m6-6-6 6 6 6',
  chevron: 'm9 5 7 7-7 7',
  down: 'm6 9 6 6 6-6',
  menu: 'M4 6h16 M4 12h16 M4 18h16',
  close: 'm6 6 12 12 M6 18 18 6',
  sun: 'M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0 M12 2v2 M12 20v2 M2 12h2 M20 12h2 M5 5l1 1 M18 18l1 1 M5 19l1-1 M18 6l1-1',
  moon: 'M21 13a9 9 0 1 1-10-10 7 7 0 0 0 10 10z',
  logout: 'M9 4H4v16h5 M10 12h11 m-5-5 5 5-5 5',
  search: 'M18 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0 m-2 6 5 5',
  grid: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
  list: 'M8 6h13 M8 12h13 M8 18h13 M3 6h1 M3 12h1 M3 18h1',
  more: 'M5 12h.01 M12 12h.01 M19 12h.01',
  edit: 'm15 4 5 5 M4 20l5-1L21 7l-5-5L4 14z',
  file: 'M14 2H4v20h16V8z M14 2v6h6 M8 13h8 M8 17h5',
  video: 'M3 5h13v14H3z m13 5 5-3v10l-5-3',
  image: 'M3 3h18v18H3z m0 14 5-5 4 4 4-7 5 8 M8 7h.01',
  archive: 'M3 3h18v5H3z M5 8v13h14V8 M10 12h4',
  upload: 'M12 16V3 m-5 5 5-5 5 5 M3 16v5h18v-5',
  download: 'M12 3v13 m-5-5 5 5 5-5 M3 17v4h18v-4',
  check: 'm5 12 4 4L19 6',
  alert: 'm12 3 10 18H2z M12 9v5 M12 17h.01',
  clock: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0 M12 7v5l3 2',
  shield: 'm12 2 8 3v6c0 6-8 11-8 11S4 17 4 11V5z m-4 9 3 3 5-5',
  panel: 'M3 3h18v18H3z M9 3v18 m6-12-3 3 3 3',
  trash: 'M3 6h18 M9 6V3h6v3 M5 6l1 15h12l1-15 M10 10v7 M14 10v7',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12 M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
} as const
export type IconName=keyof typeof paths
export function Icon({ name,size=20,...props }: SVGProps<SVGSVGElement>&{ name: IconName; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
    <path d={paths[name]} />
  </svg>
}
