// ==UserScript==
// @name         TeleWarp
// @namespace    https://example.com/
// @version      1.0
// @description  Integrate TeleWarp with project editors.
// @author       8to16
// @match        https://turbowarp.org/*
// @match        https://mirror.turbowarp.xyz/*
// @match        https://omniblocks.github.io/*
// @grant        none
// @license      GPL-3.0
// ==/UserScript==

;(() => {
  'use strict'

  const url = 'https://example.com'

  function updateButton() {
    // Don't add if button already exists anywhere
    if (document.querySelector('[data-telewarp-button]')) return

    const feedbackItems = Array.from(
      document.querySelectorAll("div[class*='menu-bar_menu-bar-item_']"),
    ).filter((item) => item.querySelector("[class^='menu-bar_feedback-link_']"))

    if (!feedbackItems.length) return

    // Hide button if a Scratch project is loaded.
    if (window.vm?.runtime?.storage?.projectToken !== null) return

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
      btn.onclick = () => window.open(url, '_blank')

      const newContainer = document.createElement('div')
      newContainer.className = 'menu-bar_menu-bar-item_oLDa-'
      newContainer.appendChild(btn)

      previousItem.parentElement.insertBefore(newContainer, previousItem)
    })
  }

  const observer = new MutationObserver(updateButton)
  observer.observe(document.body, { childList: true, subtree: true })
  setInterval(updateButton, 500)
  updateButton()
})()
