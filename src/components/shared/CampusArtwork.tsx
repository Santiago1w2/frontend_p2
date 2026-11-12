export function CampusArtwork({ className='' }: { className?: string }) {
  return <svg className={'campus-art '+className} viewBox="0 0 360 310" fill="none" aria-hidden="true" focusable="false">
    <ellipse className="art-orbit" cx="181" cy="236" rx="141" ry="38" transform="rotate(-12 181 236)" />
    <path className="art-ribbon art-ribbon-back" d="M114 237C61 163 117 57 187 73c76 17 117 114 54 164-47 38-112-2-94-69 17-66 80-96 112-44" />
    <path className="art-ribbon art-ribbon-light" d="M111 235C82 179 114 107 167 104c66-5 104 62 73 105" />
    <path className="art-ribbon art-ribbon-front" d="M87 231c-26-57 13-113 71-98 67 17 64 101 11 105-48 4-53-69-6-105 39-30 83-37 107-7" />
    <path className="art-spark" d="M290 50v26m-13-13h26M58 118v16m-8-8h16" />
    <circle className="art-dot" cx="297" cy="218" r="5" />
  </svg>
}
