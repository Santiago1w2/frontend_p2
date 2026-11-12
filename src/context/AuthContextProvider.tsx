import { useEffect,useRef,useState } from 'react'
import type { ReactNode } from 'react'
import type { User,UserCredentials } from '../types/User'
import * as AuthService from '../services/AuthService'
import { AuthContext } from './AuthContext'
import { session } from '../lib/session'
import { queryCache } from '../lib/queryCache'
import { ApiError } from '../api/errors'

export default function AuthContextProvider({ children }: { children: ReactNode }) {
  const [token,setToken]=useState(session.token)
  const [user,setUser]=useState<User|null>(null)
  const [checking,setChecking]=useState(Boolean(token))
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState<unknown>(null)
  const [expired,setExpired]=useState(false)
  const [attempt,setAttempt]=useState(0)
  const loginController=useRef<AbortController|null>(null)
  useEffect(() => {
    const unsubscribe=session.subscribe(reason => {
      queryCache.clear()
      setUser(null)
      setToken(session.token())
      setChecking(Boolean(session.token()))
      setError(null)
      setExpired(reason==='expired')
    })
    window.addEventListener('storage',session.sync)
    return () => { unsubscribe(); window.removeEventListener('storage',session.sync); loginController.current?.abort() }
  },[])
  useEffect(() => {
    if(!token) return
    const controller=new AbortController()
    const expiry=session.expiresAt()
    if(expiry&&expiry<=Date.now()) { session.clear('expired'); return }
    const timer=expiry? window.setTimeout(() => session.clear('expired'),expiry-Date.now()):undefined
    void AuthService.me(controller.signal).then(current => {
      if(controller.signal.aborted||token!==session.token()) return
      if(!['student','teacher','tenant_admin'].includes(current.role)||current.status!=='active') {
        session.clear('expired')
        return
      }
      setUser(current)
      setChecking(false)
    }).catch(error => {
      if(!controller.signal.aborted&&token===session.token()) { setError(error); setChecking(false) }
    })
    return () => { controller.abort(); window.clearTimeout(timer) }
  },[token,attempt])
  async function login(credentials: UserCredentials) {
    loginController.current?.abort()
    const controller=new AbortController()
    loginController.current=controller
    setBusy(true)
    setError(null)
    try {
      const result=await AuthService.login(credentials,controller.signal)
      if(!result.accessToken||!Number.isFinite(result.expiresIn)||result.expiresIn<=0) throw new ApiError('INVALID_RESPONSE','La respuesta no contiene una sesión válida.')
      if(!controller.signal.aborted) session.save(result.accessToken,result.expiresIn)
    } catch(error) { if(!controller.signal.aborted) setError(error) }
    finally { if(!controller.signal.aborted) setBusy(false) }
  }
  async function logout() {
    setBusy(true)
    try { await AuthService.endSession() }
    catch { setError(new ApiError('LOGOUT_FAILED','La sesión local se cerró, pero no pudimos confirmar la revocación en el servidor. El token remoto puede seguir activo hasta expirar.')) }
    finally { setBusy(false) }
  }
  function retry() { setError(null); setChecking(true); setAttempt(value => value+1) }
  return <AuthContext.Provider value={{ user,checking,busy,error,expired,login,logout,retry }}>{children}</AuthContext.Provider>
}
