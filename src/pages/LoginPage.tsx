import { useState } from 'react'
import type { FormEvent } from 'react'
import { useAuth } from '../context/AuthContext'
import { session } from '../lib/session'
import { Redirect } from '../components/shared/Guards'
import { Button,FormField } from '../components/ui/Controls'
import { Icon } from '../components/ui/Icon'
import { ThemeToggle } from '../components/layout/ThemeToggle'
import { ErrorState } from '../components/shared/States'
import { Brand } from '../components/shared/Brand'
import { CampusArtwork } from '../components/shared/CampusArtwork'

export default function LoginPage() {
  const auth=useAuth()
  const [email,setEmail]=useState('')
  const [password,setPassword]=useState('')
  const [visible,setVisible]=useState(false)
  const isolatedPreview=import.meta.env.MODE==='isolated-preview'
  const emailHasLookupPrefix=/^EMAIL#/i.test(email.trim())
  if(auth.user) return <Redirect to="/app" />
  async function submit(event: FormEvent) { event.preventDefault(); await auth.login({ email: email.trim().toLowerCase(),password }); setPassword('') }
  return <div className="login-page">
    <section className="login-story">
      <Brand inverse />
      <div className="login-editorial">
        <p className="eyebrow">EL FUTURO EMPIEZA CON UNA IDEA</p>
        <h1>Todo lo que eres.<br />Todo lo que<br /><em>puedes llegar a ser.</em></h1>
        <p>Un lugar para aprender, crear y darle forma a lo que viene. Bienvenido a tu campus.</p>
        <CampusArtwork className="login-art" />
      </div>
      <div className="login-footer"><span>UN CAMPUS. INFINITAS POSIBILIDADES.</span><span>AURION / APRENDIZAJE CON PROPÓSITO</span></div>
    </section>
    <section className="login-form-side">
      <div className="login-theme">
        <ThemeToggle />
      </div>
      <div className="login-form-wrap">
        <p className="eyebrow">TU PRÓXIMO CAPÍTULO</p>
        <h2>Qué bueno<br /><span>tenerte aquí.</span></h2>
        <p className="muted">Entra a Aurion. Tus ideas te están esperando.</p>
        {isolatedPreview&&<aside className="notice" role="note" aria-label="Entorno de pruebas aislado">
          <strong>Entorno de prueba · Sin conexión a AWS</strong>
          <p>Las cuentas de tu base de datos no funcionan aquí. Para acceder con tu cuenta real, abre el frontend iniciado con <code>npm run dev</code>.</p>
          <p>Las cuentas ficticias de este entorno están en README.md.</p>
        </aside>}
        {auth.expired&&<div className="notice" role="status">Tu sesión terminó. Inicia sesión nuevamente para continuar.</div>}
        <ErrorState error={auth.error} compact />
        {auth.error&&session.token()? <div className="stack">
          <Button onClick={auth.retry}>Reintentar validación</Button>
          <Button variant="secondary" onClick={() => void auth.logout()}>Cerrar sesión local</Button>
        </div>:<form className="stack login-form" onSubmit={submit}>
          <FormField id="login-email" label="Correo electrónico" hint={emailHasLookupPrefix? 'EMAIL# es una clave interna de la base de datos. Introduce solo tu correo.':undefined}>
            <input id="login-email" type="email" autoComplete="username" required value={email} onChange={event => setEmail(event.target.value)} placeholder="tu@universidad.edu" aria-describedby={emailHasLookupPrefix? 'login-email-hint':undefined} disabled={auth.busy||auth.checking} />
          </FormField>
          <FormField id="login-password" label="Contraseña">
            <div className="password-input">
              <input id="login-password" type={visible? 'text':'password'} autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} disabled={auth.busy||auth.checking} />
              <button type="button" className="icon-button" aria-label={visible? 'Ocultar contraseña':'Mostrar contraseña'} aria-pressed={visible} onClick={() => setVisible(!visible)}>
                <Icon name="eye" size={18} />
              </button>
            </div>
          </FormField>
          <Button type="submit" className="login-submit" loading={auth.busy||auth.checking}>Entrar a mi campus <Icon name="arrow" size={18} /></Button>
        </form>}
        <p className="login-help"><Icon name="shield" size={15} />Tu cuenta la gestiona el administrador de tu campus.</p>
      </div>
      <span className="login-fineprint">Aurion · Un lugar para lo que viene.</span>
    </section>
  </div>
}
