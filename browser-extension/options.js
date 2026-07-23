const input = document.getElementById('token')
const status = document.getElementById('status')

chrome.storage.local.get('pairingToken', ({ pairingToken }) => {
  if (pairingToken) input.value = pairingToken
})

document.getElementById('save').addEventListener('click', () => {
  const token = input.value.trim()
  chrome.storage.local.set({ pairingToken: token }, () => {
    status.textContent = 'Saved.'
    setTimeout(() => {
      status.textContent = ''
    }, 2000)
  })
})
