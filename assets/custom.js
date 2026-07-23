let _isTouchLikeCache = null;
function isTouchLikeDevice() {
  if (_isTouchLikeCache === null) {
    _isTouchLikeCache = window.matchMedia('(hover: none), (pointer: coarse)').matches;
  }
  return _isTouchLikeCache;
}

function closeAllDropdowns(except) {
  document.querySelectorAll('.wrapper-dropdown.active').forEach(dropdown => {
    if (dropdown !== except) dropdown.classList.remove('active');
  });
}

function canOpenOnHover(dropdown) {
  return !dropdown?.dataset.hoverLocked;
}

/* While the page is scrolling, the pointer can slide under a dropdown and fire
   mouseenter, opening it unexpectedly and causing jank. Suppress hover-open for
   a short idle window after the last scroll so opening only happens on a real
   mouse move. */
let isPageScrolling = false;
let scrollIdleTimer = null;
window.addEventListener('scroll', () => {
  isPageScrolling = true;
  if (scrollIdleTimer) clearTimeout(scrollIdleTimer);
  scrollIdleTimer = setTimeout(() => { isPageScrolling = false; }, 150);
}, { passive: true });

function isCornerCartActive() {
  return Boolean(
    window.corner ||
    document.querySelector('.corner-widget, #corner-widget-page-wrapper, #corner-cowi-cart-wrapper, #corner-cowi-header')
  );
}

function getInventoryMessage(inventory, isAvailable = true) {
  const qty = parseInt(inventory, 10) || 0;
  const template = window.themeStrings?.inventoryStatus || 'Only __COUNT__ left';

  if (!isAvailable || qty <= 0) return window.themeStrings?.outOfStock || 'Out of stock';
  if (qty < 100) return template.replace('__COUNT__', qty);
  return window.themeStrings?.inStock || 'In stock';
}

function syncSelectedDropdownItem(parent) {
  if (!parent) return;

  const hiddenInput = parent.querySelector('.custom-variant-id');
  const selectedId = hiddenInput?.value;

  parent.querySelectorAll('.dropdown-item').forEach(item => {
    const isSelected = item.dataset.id === selectedId;
    item.classList.toggle('is-selected', isSelected);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.wrapper-dropdown').forEach(syncSelectedDropdownItem);
});

document.addEventListener('mouseenter', (e) => {
  if (isTouchLikeDevice()) return;
  if (isPageScrolling) return; // ignore scroll-induced mouseenter

  const dropdownWrap = e.target.closest('.wrapper-dropdown');
  if (!dropdownWrap) return;
  if (!canOpenOnHover(dropdownWrap)) return;

  closeAllDropdowns(dropdownWrap);
  dropdownWrap.classList.add('active');
}, true);

document.addEventListener('mouseleave', (e) => {
  if (isTouchLikeDevice()) return;

  const dropdownWrap = e.target.closest('.wrapper-dropdown');
  if (!dropdownWrap) return;

  delete dropdownWrap.dataset.hoverLocked;
  dropdownWrap.classList.remove('active');
}, true);

document.addEventListener('click', (e) => {
  const dropdownWrap = e.target.closest('.wrapper-dropdown');
  const item = e.target.closest('.dropdown-item');

  if (item) {
    const parent = item.closest('.wrapper-dropdown');
    const card = item.closest('.product-card-primary');
    const display = parent.querySelector('.selected-display');
    const hiddenInput = parent.querySelector('.custom-variant-id');

    const selectedTitle = (item.dataset.selectedTitle || item.querySelector('.item-title')?.childNodes[0]?.textContent || item.querySelector('.item-title')?.textContent || '').trim();
    const selectedPieces = (item.dataset.pieces || '').trim();
    display.innerHTML = `<b>${selectedTitle}</b>` + (selectedPieces ? ` <span class="selected-display-pieces">( ${selectedPieces} )</span>` : '');

    const { id, price, compare, unit, inventory, available } = item.dataset;
    const inventoryQty = parseInt(inventory, 10) || 0;
    const isVariantAvailable = typeof available === 'undefined'
      ? inventoryQty > 0
      : available === 'true';

    if (hiddenInput) hiddenInput.value = id;
    syncSelectedDropdownItem(parent);
    parent.dataset.hoverLocked = 'true';
    parent.classList.remove('active');

    const priceWrap = card.querySelector('.fc_price_weight');
    if (priceWrap) {
      const sellingPriceEl = priceWrap.querySelector('.selling_price');
      const compareEl = priceWrap.querySelector('#compare_price');
      const unitEl = priceWrap.querySelector('.fc_weight');
      const percentBadge = card.querySelector('[data-card-off-percent]');
      const topBadge = card.querySelector('[data-card-top-badge]');
      const topBadgeText = card.querySelector('[data-card-top-badge-text]');
      const isBestsellerProduct = topBadge?.dataset.isBestseller === 'true';

      if (sellingPriceEl) sellingPriceEl.innerText = price;

      if (unitEl) {
        if (unit && unit.trim() !== '') {
          unitEl.innerText = unit;
          unitEl.style.display = 'inline-block';
        } else {
          unitEl.innerText = '';
          unitEl.style.display = 'none';
        }
      }

      if (compare && compare.trim() !== '' && compare !== price) {
        if (sellingPriceEl) sellingPriceEl.classList.remove('withoutbg');

        if (compareEl) {
          compareEl.innerText = compare;
          compareEl.style.display = 'inline-block';
        }

        if (percentBadge) {
          const rawPrice = parseFloat(price.replace(/[^\d.]/g, ''));
          const rawCompare = parseFloat(compare.replace(/[^\d.]/g, ''));

          if (rawCompare > rawPrice) {
            const percentOff = Math.round(((rawCompare - rawPrice) * 100) / rawCompare);
            percentBadge.innerText = '-' + percentOff + '%';
            percentBadge.style.display = 'inline-block';
            // Future use:
            // if (topBadge && topBadgeText && !isBestsellerProduct) {
            //   topBadgeText.innerText = '-' + percentOff + '%';
            //   topBadge.style.display = 'block';
            // }
          } else {
            percentBadge.style.display = 'none';
            if (topBadge && !isBestsellerProduct) topBadge.style.display = 'none';
          }
        }
      } else {
        if (sellingPriceEl) sellingPriceEl.classList.add('withoutbg');
        if (compareEl) compareEl.style.display = 'none';
        if (percentBadge) percentBadge.style.display = 'none';
        if (topBadge && !isBestsellerProduct) topBadge.style.display = 'none';
      }
    }

    // Trust text ("Almost sold out" + USP) is product-level and rendered in
    // Liquid; it must not be overwritten on variant change.

    const addBtn = card.querySelector('.add-to-cart-btn');
    const addFormInput = card.querySelector('.product-card-add-form input[name="id"]');
    const addWrap = card.querySelector('.fc_add_to_cart');

    if (addFormInput) addFormInput.value = id;
    if (addWrap) {
      addWrap.dataset.variantId = id;
      addWrap.dataset.available = isVariantAvailable ? 'true' : 'false';
      addWrap.dataset.inventory = inventory;
    }

    if (addBtn) {
      const label = addBtn.querySelector('.btn-label');
      addBtn.classList.remove('loading', 'success');

      if (isVariantAvailable) {
        addBtn.disabled = false;
        addBtn.classList.remove('out-of-stock');
        if (label) label.textContent = window.themeStrings.addToCart;
      } else {
        addBtn.disabled = true;
        addBtn.classList.add('out-of-stock');
        if (label) label.textContent = window.themeStrings.soldOut;
      }
    }

    return;
  }

  if (dropdownWrap && isTouchLikeDevice()) {
    closeAllDropdowns(dropdownWrap);
    dropdownWrap.classList.toggle('active');
    return;
  }

  if (!dropdownWrap) {
    closeAllDropdowns();
  }
});

window.handleProductCardAddFormSubmit = async function (form, event) {
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();

  if (form.dataset.submitting === 'true') return;
  form.dataset.submitting = 'true';

  const submitButton = form.querySelector('.add-to-cart-btn');
  const buttonLabel = submitButton?.querySelector('.btn-label');
  const currentWrap = form.querySelector('.fc_add_to_cart');

  if (submitButton) {
    submitButton.classList.remove('success');
    submitButton.classList.add('loading');
    submitButton.disabled = true;
  }

  try {
    const response = await fetch('/cart/add.js', {
      method: 'POST',
      body: new FormData(form),
      headers: {
        Accept: 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Add to cart failed: ${response.status}`);
    }

    await response.json();

    /* Update cart count */
    const cart = await fetch('/cart.js').then(r => r.json());

    document.querySelectorAll('[data-ajax-cart-bind="item_count"]').forEach(el => {
      el.textContent = cart.item_count;
      el.classList.toggle('is-hidden', cart.item_count === 0);
    });

    if (submitButton) {
      submitButton.classList.remove('loading');
      if (buttonLabel) {
        buttonLabel.textContent = window.themeStrings?.addedToCart || 'Added';
      }
      submitButton.classList.add('success');
    }

    document.dispatchEvent(new CustomEvent('cart:updated'));

    window.setTimeout(() => {
      document.querySelector('.cart-open, #corner-cowi-open-primary-card')?.click();
    }, 100);
  } catch (error) {
    console.error('Product card add to cart failed', error);

    if (submitButton) {
      submitButton.classList.remove('loading', 'success');
      submitButton.disabled = false;
      if (buttonLabel) {
        buttonLabel.textContent = currentWrap?.dataset.available === 'true'
          ? window.themeStrings.addToCart
          : window.themeStrings.soldOut;
      }
    }

    form.dataset.submitting = 'false';
    return;
  }

  window.setTimeout(() => {
    form.dataset.submitting = 'false';

    if (submitButton) {
      submitButton.classList.remove('loading', 'success');
      submitButton.disabled = false;
      if (buttonLabel) {
        buttonLabel.textContent = currentWrap?.dataset.available === 'true'
          ? window.themeStrings.addToCart
          : window.themeStrings.soldOut;
      }
    }
  }, 1200);
};

window.bindProductCardAddForms = function () {
  if (window.productCardAddFormsDelegated === true) return;
  window.productCardAddFormsDelegated = true;

  document.addEventListener('submit', (event) => {
    const form = event.target?.closest?.('.product-card-add-form');
    if (!form) return;

    window.handleProductCardAddFormSubmit(form, event);
  }, true);

  document.addEventListener('click', (event) => {
    const button = event.target?.closest?.('.product-card-add-form .add-to-cart-btn');
    if (!button) return;

    const form = button.closest('.product-card-add-form');
    if (!form) return;

    window.handleProductCardAddFormSubmit(form, event);
  }, true);
};

window.bindProductCardAddForms();

const sidebar = document.querySelector('.filter-sidebar');
const closeBtn = document.querySelector('.filter-close-mob');
const body = document.body;

if (sidebar && closeBtn) {
  // Function to sync body state
  function syncBodyState() {
    if (sidebar.classList.contains('active')) {
      body.setAttribute('data-lenis-prevent', '');
      body.classList.add('backdrop');
    } else {
      body.removeAttribute('data-lenis-prevent');
      body.classList.remove('backdrop');
    }
  }

  // Watch for class changes (in case it's toggled elsewhere)
  const observer = new MutationObserver(syncBodyState);

  observer.observe(sidebar, {
    attributes: true,
    attributeFilter: ['class']
  });

  // Close button click
  closeBtn.addEventListener('click', () => {
    sidebar.classList.remove('active');
    syncBodyState(); // ensure cleanup immediately
  });

  // Run once on load
  syncBodyState();
}


document.addEventListener("DOMContentLoaded", function () {
  document.querySelectorAll('.review-link').forEach(link => {
    link.addEventListener('click', function (e) {
      e.preventDefault();

      // 👇 use your actual class here
      const target = document.querySelector('.okeReviews');

      if (target) {
        target.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });
});
