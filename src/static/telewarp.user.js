// ==UserScript==
// @name         TeleWarp
// @version      1.0
// @match        https://turbowarp.org/*
// @match        https://mirror.turbowarp.xyz/*
// @match        https://omniblocks.github.io/*
// @license      GPL-3.0
// @grant        none
// ==/UserScript==

// a lot of this code is from github.com/ScratchAddons/ScratchAddons
;(() => {
  'use strict'

  const API_URL = 'http://localhost:3000/api/upload'
  const CLOSE_ICON =
    'data:image/svg+xml;base64,PHN2ZyBpZD0iTGF5ZXJfMSIgZGF0YS1uYW1lPSJMYXllciAxIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA3LjQ4IDcuNDgiPjxkZWZzPjxzdHlsZT4uY2xzLTF7ZmlsbDpub25lO3N0cm9rZTojZmZmO3N0cm9rZS1saW5lY2FwOnJvdW5kO3N0cm9rZS1saW5lam9pbjpyb3VuZDtzdHJva2Utd2lkdGg6MnB4O308L3N0eWxlPjwvZGVmcz48dGl0bGU+aWNvbi0tYWRkPC90aXRsZT48bGluZSBjbGFzcz0iY2xzLTEiIHgxPSIzLjc0IiB5MT0iNi40OCIgeDI9IjMuNzQiIHkyPSIxIi8+PGxpbmUgY2xhc3M9ImNscy0xIiB4MT0iMSIgeTE9IjMuNzQiIHgyPSI2LjQ4IiB5Mj0iMy43NCIvPjwvc3ZnPg=='

  const ScratchCSS = (() => {
    const cache = new Map()
    function find(prefix) {
      if (cache.has(prefix)) return cache.get(prefix)
      for (const sheet of document.styleSheets) {
        let rules
        try {
          rules = sheet.cssRules
        } catch {
          continue
        }
        for (const rule of rules) {
          if (!rule.selectorText) continue
          const m = rule.selectorText.match(new RegExp(`\\.(${prefix}[^\\s\\.,:]*)`))
          if (m) {
            cache.set(prefix, m[1])
            return m[1]
          }
        }
      }
      cache.set(prefix, prefix)
      return prefix
    }
    return { find }
  })()

  function createModal(title) {
    const overlay = ScratchCSS.find('modal_modal-overlay')
    const contentC = ScratchCSS.find('modal_modal-content')
    const headerC = ScratchCSS.find('modal_header')
    const headerItem = ScratchCSS.find('modal_header-item')
    const headerTitle = ScratchCSS.find('modal_header-item-title')
    const headerClose = ScratchCSS.find('modal_header-item-close')
    const closeBtnC = ScratchCSS.find('close-button_close-button')
    const closeIcon = ScratchCSS.find('close-button_close-icon')

    const backdrop = document.createElement('div')
    backdrop.className = overlay
    document.body.appendChild(backdrop)

    const modal = document.createElement('div')
    modal.className = contentC
    modal.style.background = 'var(--ui-modal-background)'
    modal.style.width = '600px'
    modal.addEventListener('click', (e) => e.stopPropagation())
    backdrop.appendChild(modal)

    const header = document.createElement('div')
    header.className = headerC
    modal.appendChild(header)

    const titleEl = document.createElement('div')
    titleEl.className = `${headerItem} ${headerTitle}`
    titleEl.textContent = title
    header.appendChild(titleEl)

    const closeWrap = document.createElement('div')
    closeWrap.className = `${headerItem} ${headerClose}`
    header.appendChild(closeWrap)

    const closeBtn = document.createElement('div')
    closeBtn.className = closeBtnC
    closeWrap.appendChild(closeBtn)

    const closeImg = document.createElement('img')
    closeImg.className = closeIcon
    closeImg.src = CLOSE_ICON
    closeImg.draggable = false
    closeBtn.appendChild(closeImg)

    const body = document.createElement('div')
    body.style.padding = '1rem'
    modal.appendChild(body)

    const close = () => backdrop.remove()
    closeBtn.onclick = close
    backdrop.onclick = close

    return { body, close }
  }

  async function captureStageThumbnail() {
    if (!window.vm?.renderer?.requestSnapshot) {
      throw new Error('VM renderer snapshot API not found')
    }

    // Enable transparent preview temporarily
    window.vm.postIOData?.('video', { forceTransparentPreview: true })

    const dataURL = await new Promise((resolve) => {
      window.vm.renderer.requestSnapshot(resolve)
    })

    // Disable transparent preview
    window.vm.postIOData?.('video', { forceTransparentPreview: false })

    // Convert dataURL to Blob
    const blob = await fetch(dataURL).then((r) => r.blob())
    return blob
  }

  async function openUploadModal() {
    if (!window.vm) return

    const modal = createModal('Upload project')
    const { body } = modal

    body.innerHTML = `
      <label>Project name</label>
      <input id="tw-name" class="${ScratchCSS.find('input_input-form_')}" style="width:100%" />

      <label style="margin-top:.5rem;display:block">Notes</label>
      <textarea id="tw-desc" rows="4" style="width:100%"></textarea>

      <h3 style="margin-top:1rem">Thumbnail</h3>
      <img id="tw-thumb" style="max-width:100%;display:none;border-radius:8px" />
      <button id="tw-regenerate" type="button" class="${ScratchCSS.find('settings-modal_button_')}">Regenerate thumbnail</button>

      <div style="margin-top:1rem;text-align:right">
        <button id="tw-upload" class="${ScratchCSS.find('settings-modal_button_')}">Upload</button>
      </div>

      <div id="tw-status" style="margin-top:.5rem"></div>
    `

    const nameInput = body.querySelector('#tw-name')
    const descInput = body.querySelector('#tw-desc')
    const thumbImg = body.querySelector('#tw-thumb')
    const regenBtn = body.querySelector('#tw-regenerate')
    const uploadBtn = body.querySelector('#tw-upload')
    const status = body.querySelector('#tw-status')

    const sb3 = await window.vm.saveProjectSb3()

    nameInput.value = window.ReduxStore?.getState()?.scratchGui?.projectTitle || 'Untitled'

    let thumbnailBlob = null

    async function regenerate() {
      status.textContent = 'Capturing thumbnail…'
      try {
        thumbnailBlob = await captureStageThumbnail()
        thumbImg.src = URL.createObjectURL(thumbnailBlob)
        thumbImg.style.display = 'block'
        status.textContent = ''
      } catch (e) {
        status.textContent = e.message
      }
    }

    regenBtn.onclick = regenerate
    await regenerate()

    uploadBtn.onclick = async () => {
      status.textContent = 'Uploading…'

      const form = new FormData()
      form.append('projectFile', new File([sb3], `${nameInput.value}.sb3`))
      form.append('projectName', nameInput.value)
      form.append('projectDescription', descInput.value)
      if (thumbnailBlob) form.append('thumbnail', thumbnailBlob, 'thumbnail.png')
      const langId = location.hostname === 'omniblocks.github.io' ? 'ob' : 'tw'
      form.append('langId', langId)

      try {
        const res = await fetch(API_URL, { method: 'POST', body: form })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error)
        modal.close()
        window.open(`http://localhost:3000/projects/${json.id}`, '_blank')
      } catch (e) {
        status.textContent = e.message
      }
    }
  }

  function updateButton() {
    if (document.querySelector('[data-telewarp-button]')) return

    const feedbackItems = Array.from(
      document.querySelectorAll("div[class*='menu-bar_menu-bar-item_']"),
    ).filter((item) => item.querySelector("[class^='menu-bar_feedback-link_']"))

    if (!feedbackItems.length) return

    feedbackItems.forEach((item) => {
      const previousItem = item.previousElementSibling
      if (!previousItem) return

      const feedbackButton = item.querySelector("[class*='menu-bar_feedback-button_']")
      if (!feedbackButton) return

      const classes = Array.from(feedbackButton.classList).join(' ')

      const btn = document.createElement('button')
      btn.textContent = 'Upload to TeleWarp'
      btn.className = classes
      btn.setAttribute('data-telewarp-button', 'true')
      btn.style.cssText = feedbackButton.style.cssText
      btn.style.backgroundColor = '#ff8c1a'
      btn.style.border = 'none'
      btn.style.color = '#fff'

      btn.onclick = () => openUploadModal()

      const newContainer = document.createElement('div')
      newContainer.className = 'menu-bar_menu-bar-item_oLDa-'
      newContainer.appendChild(btn)

      previousItem.parentElement.insertBefore(newContainer, previousItem)
    })
  }

  new MutationObserver(updateButton).observe(document.body, { childList: true, subtree: true })
  updateButton()
})()
