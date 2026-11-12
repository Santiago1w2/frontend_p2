export function Brand({ inverse=false,className='' }: { inverse?: boolean; className?: string }) {
  return <span className={'brand '+(inverse? 'brand-inverse ':'')+className} role="img" aria-label="Aurion">
    <img className="brand-lockup brand-on-light" src="/brand/aurion-logo-light.svg" alt="" width="167" height="48" />
    <img className="brand-lockup brand-on-dark" src="/brand/aurion-logo-dark.svg" alt="" width="167" height="48" />
    <img className="brand-symbol" src="/brand/aurion-mark.svg" alt="" width="44" height="44" />
  </span>
}
export function BrandMark({ className='' }: { className?: string }) {
  return <img className={'aurion-mark '+className} src="/brand/aurion-mark.svg" alt="" aria-hidden="true" width="84" height="84" />
}
