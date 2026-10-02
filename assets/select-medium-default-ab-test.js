/**
 * A/B Test: Select Medium (Bestseller) option by default
 *
 * Control (A): keep theme default (is_prior / first available)
 *   — body[data-select-medium-default="false"]
 * Variant (B): pre-select Medium / bestseller option
 *   — body[data-select-medium-default="true"]
 *
 * IntelliGems (or similar) sets the attribute on <body>.
 * Dev override: ?select_medium_default=a|b|true|false
 */
(function () {
  'use strict';

  if (window.__selectMediumDefaultABTestInit) return;
  window.__selectMediumDefaultABTestInit = true;

  var BODY_ATTR = 'data-select-medium-default';
  var timer = null;
  var busy = false;
  var selecting = false;
  var applied = false;
  var userPicked = false;

  function getDevOverride() {
    try {
      return new URLSearchParams(window.location.search).get('select_medium_default');
    } catch (e) {
      return null;
    }
  }

  function isVariantB() {
    var override = getDevOverride();
    if (override === 'b' || override === 'true') return true;
    if (override === 'a' || override === 'false') return false;

    var body = document.body;
    return !!(body && body.getAttribute(BODY_ATTR) === 'true');
  }

  function normalize(text) {
    return String(text || '').replace(/\s+/g, ' ').trim().toLowerCase();
  }

  function isSoldOut(li) {
    if (!li) return true;
    if (li.classList.contains('is-sold-out')) return true;
    if (li.getAttribute('data-available') === 'false') return true;
    return false;
  }

  function findBestsellerOption(root) {
    var scope = root || document;
    var options = scope.querySelectorAll(
      'variant-selector .variant-value[data-best="bestseller"]'
    );
    var i;
    var li;

    for (i = 0; i < options.length; i++) {
      li = options[i];
      if (!isSoldOut(li)) return li;
    }

    // Fallback: option that renders a .vv-bestseller badge
    options = scope.querySelectorAll('variant-selector .variant-value');
    for (i = 0; i < options.length; i++) {
      li = options[i];
      if (isSoldOut(li)) continue;
      if (li.querySelector('.vv-bestseller')) return li;
    }

    // Last resort: match by "Medium" label inside .vvv-value
    for (i = 0; i < options.length; i++) {
      li = options[i];
      if (isSoldOut(li)) continue;
      var label = li.querySelector('.vvv-value');
      if (label && normalize(label.textContent).indexOf('medium') !== -1) {
        return li;
      }
    }

    return null;
  }

  function isSelected(li) {
    return !!(li && li.classList.contains('active'));
  }

  function selectOption(li) {
    if (!li || isSoldOut(li)) return false;

    selecting = true;
    try {
      li.click();
      return isSelected(li);
    } finally {
      selecting = false;
    }
  }

  function process() {
    if (busy || userPicked) return;
    if (!isVariantB()) {
      applied = false;
      return;
    }

    busy = true;
    try {
      var li = findBestsellerOption();
      if (!li) return;

      if (isSelected(li)) {
        applied = true;
        return;
      }

      if (selectOption(li)) {
        applied = true;
      }
    } finally {
      busy = false;
    }
  }

  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(process, 50);
  }

  function onUserInteraction(event) {
    if (selecting) return;

    var li =
      event.target && event.target.closest
        ? event.target.closest('variant-selector .variant-value')
        : null;

    if (!li) return;
    userPicked = true;
  }

  function watchBodyAttribute() {
    if (!document.body || !window.MutationObserver) return;

    new MutationObserver(function () {
      applied = false;
      userPicked = false;
      schedule();
    }).observe(document.body, {
      attributes: true,
      attributeFilter: [BODY_ATTR]
    });
  }

  function watchDom() {
    if (!document.body || !window.MutationObserver) return;

    new MutationObserver(function () {
      if (userPicked || selecting) return;
      if (applied && isVariantB()) {
        var li = findBestsellerOption();
        if (li && isSelected(li)) return;
      }
      schedule();
    }).observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  function init() {
    if (!document.querySelector('variant-selector')) return;

    document.addEventListener('click', onUserInteraction, true);

    process();
    watchBodyAttribute();
    watchDom();

    setTimeout(process, 400);
    setTimeout(process, 1200);
    setTimeout(process, 2500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.addEventListener('load', schedule);
})();
