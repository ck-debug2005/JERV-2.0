const GSI_SCRIPT_URL = 'https://accounts.google.com/gsi/client'
const GOOGLE_TOKEN_KEY = 'modern_shop_google_token'

const loadGoogleScript = () =>
  new Promise((resolve, reject) => {
    if (window.google?.accounts) {
      resolve()
      return
    }

    const existing = document.querySelector(`script[src="${GSI_SCRIPT_URL}"]`)
    if (existing) {
      existing.addEventListener('load', resolve, { once: true })
      existing.addEventListener('error', () => reject(new Error('Failed to load Google script')), {
        once: true,
      })
      return
    }

    const script = document.createElement('script')
    script.src = GSI_SCRIPT_URL
    script.async = true
    script.defer = true
    script.onload = resolve
    script.onerror = () => reject(new Error('Failed to load Google script'))
    document.head.appendChild(script)
  })

export async function loginWithGoogle() {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
  if (!clientId) {
    throw new Error('Missing VITE_GOOGLE_CLIENT_ID in .env')
  }

  await loadGoogleScript()

  const accessToken = await new Promise((resolve, reject) => {
    const tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: 'openid email profile',
      callback: (response) => {
        if (response?.error) {
          if (response.error === 'popup_closed_by_user') {
            reject(new Error('Google sign-in was cancelled'))
            return
          }
          reject(new Error(response.error_description || 'Google OAuth failed'))
          return
        }
        if (!response.access_token) {
          reject(new Error('Google OAuth did not return an access token'))
          return
        }
        resolve(response.access_token)
      },
      error_callback: (error) => {
        if (error?.type === 'popup_closed') {
          reject(new Error('Google sign-in was cancelled'))
          return
        }
        reject(new Error('Google OAuth popup failed'))
      },
    })

    tokenClient.requestAccessToken({ prompt: 'select_account' })
  })

  localStorage.setItem(GOOGLE_TOKEN_KEY, accessToken)
  return accessToken
}

export async function logoutGoogleSession() {
  const token = localStorage.getItem(GOOGLE_TOKEN_KEY)
  localStorage.removeItem(GOOGLE_TOKEN_KEY)

  if (window.google?.accounts?.oauth2 && token) {
    await new Promise((resolve) => {
      window.google.accounts.oauth2.revoke(token, () => resolve())
    })
  }
}
