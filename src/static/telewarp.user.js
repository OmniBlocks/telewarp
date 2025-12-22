// ==UserScript==
// @name         TeleWarp
// @version      1.2
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
    const content = ScratchCSS.find('modal_modal-content')
    const promptContent = ScratchCSS.find('prompt_modal-content')
    const header = ScratchCSS.find('modal_header')
    const headerItem = ScratchCSS.find('modal_header-item')
    const headerTitle = ScratchCSS.find('modal_header-item-title')
    const headerClose = ScratchCSS.find('modal_header-item-close')
    const closeBtnC = ScratchCSS.find('close-button_close-button')
    const closeLarge = ScratchCSS.find('close-button_large')
    const closeIcon = ScratchCSS.find('close-button_close-icon')
    const bodyC = ScratchCSS.find('prompt_body')

    const backdrop = document.createElement('div')
    backdrop.className = overlay
    backdrop.dir = 'ltr'
    document.body.appendChild(backdrop)

    const modal = document.createElement('div')
    modal.className = `${content} ${promptContent}`
    backdrop.appendChild(modal)

    const headerEl = document.createElement('div')
    headerEl.className = header
    modal.appendChild(headerEl)

    const titleEl = document.createElement('div')
    titleEl.className = `${headerItem} ${headerTitle}`
    titleEl.textContent = title
    headerEl.appendChild(titleEl)

    const closeWrap = document.createElement('div')
    closeWrap.className = `${headerItem} ${headerClose}`
    headerEl.appendChild(closeWrap)

    const closeBtn = document.createElement('div')
    closeBtn.className = `${closeBtnC} ${closeLarge}`
    closeWrap.appendChild(closeBtn)

    const closeImg = document.createElement('img')
    closeImg.className = closeIcon
    closeImg.src = CLOSE_ICON
    closeImg.draggable = false
    closeBtn.appendChild(closeImg)

    const body = document.createElement('div')
    body.className = bodyC
    modal.appendChild(body)

    const close = () => backdrop.remove()
    closeBtn.onclick = close
    backdrop.onclick = close
    modal.onclick = (e) => e.stopPropagation()

    return { body, close }
  }

  async function captureStageThumbnail() {
    if (!window.vm?.renderer?.requestSnapshot) {
      throw new Error('VM renderer snapshot API not found')
    }

    window.vm.postIOData?.('video', { forceTransparentPreview: true })

    const dataURL = await new Promise((resolve) => {
      window.vm.renderer.requestSnapshot(resolve)
    })

    window.vm.postIOData?.('video', { forceTransparentPreview: false })

    const blob = await fetch(dataURL).then((r) => r.blob())
    return blob
  }

  async function openUploadModal() {
    if (!window.vm) return

    const modal = createModal('Share Project')
    const body = modal.body

    const labelNotes = document.createElement('div')
    labelNotes.className = ScratchCSS.find('prompt_label')
    labelNotes.textContent = 'Notes:'
    labelNotes.style.marginTop = '0.5rem'
    body.appendChild(labelNotes)

    const descInput = document.createElement('textarea')
    descInput.rows = 4
    descInput.style.resize = 'vertical'
    descInput.style.width = '100%'
    descInput.style.padding = '0.5rem'
    descInput.style.border = '1px solid var(--ui-black-transparent)'
    descInput.style.borderRadius = '4px'
    body.appendChild(descInput)

    const status = document.createElement('div')
    status.style.marginTop = '0.5rem'
    status.textContent = 'Thumbnail will be captured from the stage.'
    body.appendChild(status)

    const poweredBy = document.createElement('div')
    poweredBy.style.marginTop = '0.5rem'
    poweredBy.style.marginBottom = '0.5rem'
    poweredBy.textContent = 'Powered by TeleWarp.'
    body.appendChild(poweredBy)

    const buttonRow = document.createElement('div')
    buttonRow.className = ScratchCSS.find('prompt_button-row')
    body.appendChild(buttonRow)

    const cancelBtn = document.createElement('button')
    cancelBtn.textContent = 'Cancel'
    cancelBtn.onclick = modal.close
    buttonRow.appendChild(cancelBtn)

    const uploadBtn = document.createElement('button')
    uploadBtn.className = ScratchCSS.find('prompt_ok-button')
    uploadBtn.textContent = 'Upload'
    buttonRow.appendChild(uploadBtn)

    const sb3 = await window.vm.saveProjectSb3()
    let thumbnailBlob = null

    async function regenerate() {
      status.textContent = 'Capturing thumbnail…'
      try {
        thumbnailBlob = await captureStageThumbnail()
        status.textContent = ''
      } catch (e) {
        status.textContent = e.message
      }
    }

    uploadBtn.onclick = async () => {
      await regenerate()
      status.textContent = 'Uploading…'

      const form = new FormData()
      form.append('projectFile', new File([sb3], 'project.sb3'))
      form.append(
        'projectName',
        window.ReduxStore?.getState()?.scratchGui?.projectTitle || 'Untitled',
      )
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

    feedbackItems.forEach((item) => {
      const previousItem = item.previousElementSibling
      if (!previousItem) return

      const feedbackButton = item.querySelector("[class*='menu-bar_feedback-button_']")
      if (!feedbackButton) return

      const btn = document.createElement('button')
      btn.textContent = 'Share'
      btn.className = feedbackButton.className
      btn.setAttribute('data-telewarp-button', 'true')
      btn.style.cssText = feedbackButton.style.cssText
      btn.style.backgroundColor = '#ff8c1a'
      btn.style.border = 'none'
      btn.style.color = '#fff'
      btn.onclick = openUploadModal

      const container = document.createElement('div')
      container.className = 'menu-bar_menu-bar-item_oLDa-'
      container.appendChild(btn)

      previousItem.parentElement.insertBefore(container, previousItem)
    })
  }

  new MutationObserver(updateButton).observe(document.body, {
    childList: true,
    subtree: true,
  })

  updateButton()
})()
