/**
 * Jurassic Fruit — Purchase Options A/B
 *
 * Control (A): body[data-purchase-options-ab="false"] — Appstle default
 * Variant (B): body[data-purchase-options-ab="true"]  — custom UI
 *
 * IntelliGems: document.body.setAttribute('data-purchase-options-ab', 'true'|'false');
 * Dev: ?purchase_options_ab=a|b|true|false
 */
(function () {
  'use strict';

  if (window.__jfPurchaseOptionsInit) return;
  window.__jfPurchaseOptionsInit = true;

  var BODY_ATTR = 'data-purchase-options-ab';
  var STRINGS = window.jfPurchaseStrings || {};
  var activated = false;

  function getDevOverride() {
    try {
      return new URLSearchParams(window.location.search).get('purchase_options_ab');
    } catch (e) {
      return null;
    }
  }

  function isVariantB() {
    var override = getDevOverride();
    if (override === 'b' || override === 'true') return true;
    if (override === 'a' || override === 'false') return false;
    var body = document.body;
    var html = document.documentElement;
    if (body && body.getAttribute(BODY_ATTR) === 'true') return true;
    if (html && html.getAttribute(BODY_ATTR) === 'true') return true;
    return false;
  }

  function neutralizeCustomInputs() {
    document.querySelectorAll('[data-purchase-options] [data-selling-plan-input]').forEach(function (input) {
      input.disabled = true;
      input.removeAttribute('name');
      input.value = '';
    });
  }

  function syncAbAttributeFromUrl() {
    var override = getDevOverride();
    if (!override || !document.body) return;
    if (override === 'b' || override === 'true') {
      document.body.setAttribute(BODY_ATTR, 'true');
      document.documentElement.setAttribute(BODY_ATTR, 'true');
    } else if (override === 'a' || override === 'false') {
      document.body.setAttribute(BODY_ATTR, 'false');
      document.documentElement.setAttribute(BODY_ATTR, 'false');
    }
  }

  function parseJSON(el) {
    if (!el) return null;
    try {
      return JSON.parse(el.textContent);
    } catch (e) {
      return null;
    }
  }

  function formatMoney(cents, suffix) {
    var amount = Number(cents);
    if (!amount && amount !== 0) return '';
    if (typeof window.formatMoneySafe === 'function') {
      var safe = window.formatMoneySafe(amount);
      if (!safe && amount) {
        safe = (amount / 100).toFixed(2).replace('.', ',');
      }
      return safe ? safe + (suffix ? ' ' + suffix : '') : '';
    }
    var n = (amount / 100).toFixed(2).replace('.', ',');
    return n + (suffix ? ' ' + suffix : '');
  }

  function cleanFrequencyLabel(raw, weeksHint) {
    var weeks = Number(weeksHint) || 0;
    var up = String(raw || '').toUpperCase().replace(/\s+/g, '');
    if (!weeks) {
      var m = up.match(/(?:EVERY)?([1-9]\d*)WEEK/);
      if (m) weeks = parseInt(m[1], 10);
      else if (/WEEKLY/.test(up)) weeks = 1;
    }
    if (!weeks || weeks < 1) return '';
    var map = STRINGS.freqLabels || {};
    if (map[weeks]) return map[weeks];
    if (weeks === 1) return STRINGS.freq1 || '1 week';
    return weeks + ' ' + (STRINGS.weeksWord || 'weeks');
  }

  function isDirtyLabel(label) {
    if (!label) return true;
    var up = String(label).toUpperCase();
    return (
      up.indexOf('MIN_CYCLES') !== -1 ||
      up.indexOf('MAX_CYCLES') !== -1 ||
      up.indexOf('PERCENTAGE') !== -1 ||
      /WEEK\d|NULL/.test(up)
    );
  }

  function hideAppstleWidgets() {
    [
      '[id*="appstle_subscription"]',
      '.appstle_subscription_wrapper',
      '.appstle_sub_widget',
      '#appstle_subscription_widget0',
      '.as-subscription-wrapper',
      '[class*="appstle_subscription"]'
    ].forEach(function (sel) {
      document.querySelectorAll(sel).forEach(function (node) {
        var block = node.closest('.app-block') || node;
        if (block.getAttribute('data-jf-po-hidden') === 'true') return;
        block.style.setProperty('display', 'none', 'important');
        block.setAttribute('data-jf-po-hidden', 'true');
        block.querySelectorAll('input, select, textarea').forEach(function (field) {
          if (field.getAttribute('data-jf-po-kept') === 'true') return;
          field.disabled = true;
          if (field.name) {
            field.setAttribute('data-jf-po-name', field.name);
            field.removeAttribute('name');
          }
        });
      });
    });
  }

  function injectSellingPlanIntoBody(body, po) {
    if (!po) return body;
    var planId = po.getActivePlanId();
    var wantSub = po.isSubscription() && planId;

    if (body instanceof FormData) {
      if (wantSub) {
        body.set('selling_plan', String(planId));
        var payload = po.buildCartPayload();
        if (payload.id) body.set('id', String(payload.id));
        if (payload.quantity) body.set('quantity', String(payload.quantity));
      } else {
        body.delete('selling_plan');
      }
      return body;
    }

    if (typeof body === 'string') {
      try {
        var parsed = JSON.parse(body);
        return JSON.stringify(injectSellingPlanIntoObject(parsed, po));
      } catch (err) {
        try {
          var params = new URLSearchParams(body);
          if (wantSub) params.set('selling_plan', String(planId));
          else params.delete('selling_plan');
          return params.toString();
        } catch (e2) {
          return body;
        }
      }
    }

    if (body && typeof body === 'object') {
      return injectSellingPlanIntoObject(body, po);
    }
    return body;
  }

  function injectSellingPlanIntoObject(obj, po) {
    if (!obj || !po) return obj;
    var planId = po.getActivePlanId();
    var wantSub = po.isSubscription() && planId;
    var planVal = Number(planId) || planId;

    if (Array.isArray(obj.items)) {
      obj.items = obj.items.map(function (item) {
        if (!item || typeof item !== 'object') return item;
        if (wantSub) item.selling_plan = planVal;
        else delete item.selling_plan;
        return item;
      });
      return obj;
    }

    if (wantSub) obj.selling_plan = planVal;
    else delete obj.selling_plan;
    return obj;
  }

  function patchNetworkForSellingPlan() {
    if (window.__jfPoNetworkPatched) return;
    window.__jfPoNetworkPatched = true;

    var originalFetch = window.fetch;
    window.fetch = function (input, init) {
      try {
        var url = typeof input === 'string' ? input : (input && input.url) || '';
        var po = window.jfPurchaseOptions;
        if (url.indexOf('/cart/add') !== -1 && po) {
          init = init ? Object.assign({}, init) : {};
          if (init.body != null) init.body = injectSellingPlanIntoBody(init.body, po);
        }
      } catch (err) {}
      return originalFetch.call(this, input, init);
    };

    var OriginalXHR = window.XMLHttpRequest;
    function PatchedXHR() {
      var xhr = new OriginalXHR();
      var _open = xhr.open;
      var _send = xhr.send;
      var _url = '';
      xhr.open = function (method, url) {
        _url = String(url || '');
        return _open.apply(xhr, arguments);
      };
      xhr.send = function (body) {
        try {
          var po = window.jfPurchaseOptions;
          if (_url.indexOf('/cart/add') !== -1 && po) {
            body = injectSellingPlanIntoBody(body, po);
          }
        } catch (err) {}
        return _send.call(xhr, body);
      };
      return xhr;
    }
    PatchedXHR.prototype = OriginalXHR.prototype;
    window.XMLHttpRequest = PatchedXHR;
  }

  function PurchaseOptions(root) {
    this.root = root;
    this.input = root.querySelector('[data-selling-plan-input]');
    this.plans = parseJSON(root.querySelector('[data-po-plans]')) || [];
    this.variantPlans = parseJSON(root.querySelector('[data-po-variant-plans]')) || {};
    this.currencySuffix = root.getAttribute('data-currency-suffix') || '';
    this.mode = root.getAttribute('data-default-mode') || 'subscription';
    this.planId = root.getAttribute('data-default-plan') || (this.plans[0] && this.plans[0].id) || '';
    this.planLabel = '';

    this.sanitizePills();

    var selectedPill = root.querySelector('.jf-po__pill.is-selected');
    if (selectedPill) {
      this.planId = selectedPill.getAttribute('data-po-plan') || this.planId;
      this.planLabel =
        selectedPill.getAttribute('data-po-plan-label') ||
        selectedPill.textContent.trim();
    }

    this.bind();
    this.applyMode(this.mode, true);
    this.refreshPrices();
    this.updateAddToCartButton();
    this.guardClicks();
    patchNetworkForSellingPlan();
  }

  PurchaseOptions.prototype.getActivePlanId = function () {
    var selected = this.root.querySelector('.jf-po__pill.is-selected');
    if (selected && selected.getAttribute('data-po-plan')) {
      this.planId = selected.getAttribute('data-po-plan');
    }
    return this.planId;
  };

  PurchaseOptions.prototype.sanitizePills = function () {
    var self = this;
    this.root.querySelectorAll('[data-po-plan]').forEach(function (pill) {
      var planId = pill.getAttribute('data-po-plan');
      var plan =
        self.plans.find(function (p) {
          return String(p.id) === String(planId);
        }) || {};
      var weeks = pill.getAttribute('data-po-weeks') || plan.weeks || 0;
      var current =
        pill.getAttribute('data-po-plan-label') || pill.textContent.trim();
      var clean = plan.label || '';
      if (isDirtyLabel(clean)) clean = cleanFrequencyLabel(plan.name || current, weeks);
      if (isDirtyLabel(clean) || !clean) clean = cleanFrequencyLabel(current, weeks);
      if (!clean) clean = cleanFrequencyLabel('', weeks) || (STRINGS.freq1 || '1 week');
      pill.setAttribute('data-po-plan-label', clean);
      pill.textContent = clean;
    });
  };

  PurchaseOptions.prototype.getCornerStickySelects = function () {
    return document.querySelectorAll(
      '#corner-sticky-atc-select-0, select[id^="corner-sticky-atc-select"]'
    );
  };

  PurchaseOptions.prototype.resolveVariantIdFromCorner = function () {
    var selects = this.getCornerStickySelects();
    if (!selects.length) return null;

    var i;
    for (i = 0; i < selects.length; i++) {
      var sel = selects[i];
      var raw = (sel.value || '').trim();
      if (!raw) continue;

      var asNum = Number(raw);
      if (asNum && !isNaN(asNum) && (this.variantPlans[String(asNum)] || this.variantPlans[asNum])) {
        return asNum;
      }

      // Corner often uses option title ("1 St.") as value
      var opt = sel.options[sel.selectedIndex];
      var label = ((opt && (opt.textContent || opt.label)) || raw).replace(/\s+/g, ' ').trim();
      var match =
        document.querySelector(
          'variant-selector .variant-value[data-variant-id][data-value="' +
            raw.replace(/"/g, '\\"') +
            '"]'
        ) || null;

      if (!match) {
        var candidates = document.querySelectorAll(
          'variant-selector .variant-value[data-variant-id]'
        );
        var j;
        for (j = 0; j < candidates.length; j++) {
          var li = candidates[j];
          var title = (
            (li.querySelector('.vvv-value') && li.querySelector('.vvv-value').textContent) ||
            li.getAttribute('data-value') ||
            ''
          )
            .replace(/\s+/g, ' ')
            .trim();
          if (title === label || title === raw || li.getAttribute('data-value') === raw) {
            match = li;
            break;
          }
        }
      }

      if (match && match.getAttribute('data-variant-id')) {
        return Number(match.getAttribute('data-variant-id'));
      }
    }
    return null;
  };

  PurchaseOptions.prototype.resolveVariantId = function () {
    // Only prefer Corner when the sticky Type dropdown was the last user control
    if (this._preferCornerVariant) {
      var fromCorner = this.resolveVariantIdFromCorner();
      if (fromCorner) return fromCorner;
    }

    var active = document.querySelector(
      'variant-selector .variant-value.active[data-variant-id]'
    );
    if (active && active.getAttribute('data-variant-id')) {
      return Number(active.getAttribute('data-variant-id'));
    }
    var idInput = document.querySelector('#product-form input[name="id"]');
    if (idInput && idInput.value) return Number(idInput.value);

    var fromCornerFallback = this.resolveVariantIdFromCorner();
    if (fromCornerFallback) return fromCornerFallback;

    try {
      var fromUrl = new URLSearchParams(window.location.search).get('variant');
      if (fromUrl) return Number(fromUrl);
    } catch (e) {}
    return null;
  };

  PurchaseOptions.prototype.syncFormVariantFromCorner = function () {
    var variantId = this.resolveVariantIdFromCorner();
    if (!variantId) return null;
    this._suppressVariantWatch = true;
    try {
      var idInput = document.querySelector('#product-form input[name="id"]');
      if (idInput && String(idInput.value) !== String(variantId)) {
        // Set via native descriptor to avoid our patched setter re-entry
        var desc = Object.getOwnPropertyDescriptor(
          HTMLInputElement.prototype,
          'value'
        );
        if (desc && desc.set) desc.set.call(idInput, String(variantId));
        else idInput.value = String(variantId);
      }
      var li = document.querySelector(
        'variant-selector .variant-value[data-variant-id="' + variantId + '"]'
      );
      if (li && !li.classList.contains('active')) {
        var parent = li.parentElement;
        if (parent) {
          parent.querySelectorAll('.variant-value').forEach(function (el) {
            el.classList.remove('active');
          });
        }
        li.classList.add('active');
      }
    } finally {
      this._suppressVariantWatch = false;
    }
    return variantId;
  };

  PurchaseOptions.prototype.buildCartPayload = function () {
    var variantId = this.resolveVariantId();
    var qtyInput = document.getElementById('Quantity');
    var planId = this.getActivePlanId();
    var planNum = planId != null && planId !== '' ? Number(planId) : NaN;
    var idInput = document.querySelector('#product-form input[name="id"]');
    if (idInput && variantId) idInput.value = String(variantId);

    var payload = {
      id: variantId,
      quantity: parseInt(qtyInput && qtyInput.value, 10) || 1
    };
    if (this.isSubscription() && planNum && !isNaN(planNum)) {
      payload.selling_plan = planNum;
    }
    return payload;
  };

  PurchaseOptions.prototype.cartAddUrl = function () {
    if (window.Shopify && window.Shopify.routes && window.Shopify.routes.root) {
      return window.Shopify.routes.root + 'cart/add.js';
    }
    return '/cart/add.js';
  };

  PurchaseOptions.prototype.addToCart = function () {
    this.syncSellingPlanInput();
    var payload = this.buildCartPayload();
    if (!payload.id) return Promise.reject(new Error('Missing variant id'));
    if (this.isSubscription() && !payload.selling_plan) {
      return Promise.reject(new Error('Missing selling_plan for subscription'));
    }

    var body = { id: payload.id, quantity: payload.quantity };
    if (payload.selling_plan) body.selling_plan = payload.selling_plan;

    return fetch(this.cartAddUrl(), {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body),
      credentials: 'same-origin'
    })
      .then(function (res) {
        if (!res.ok) {
          return res.text().then(function (t) {
            throw new Error('Add to cart failed: ' + res.status + ' ' + t);
          });
        }
        return res.json();
      })
      .then(function (item) {
        document.dispatchEvent(new CustomEvent('cart:updated', { detail: item }));
        window.setTimeout(function () {
          document
            .querySelector('.cart-open, #corner-cowi-open-primary-card')
            ?.click();
        }, 120);
        return item;
      });
  };

  PurchaseOptions.prototype.runAddToCartFromUi = function (triggerEl) {
    var mainBtn = document.getElementById('add-to-cart');
    var busyEl = triggerEl || mainBtn;
    if (busyEl && busyEl.getAttribute('data-jf-po-busy') === 'true') {
      return Promise.resolve();
    }
    if (busyEl) busyEl.setAttribute('data-jf-po-busy', 'true');
    if (mainBtn) {
      mainBtn.classList.add('loading');
      mainBtn.disabled = true;
    }
    return this.addToCart()
      .catch(function (err) {
        console.error('[jf-po] Add to cart failed', err);
      })
      .finally(function () {
        if (busyEl) busyEl.removeAttribute('data-jf-po-busy');
        if (mainBtn) {
          mainBtn.classList.remove('loading');
          mainBtn.disabled = false;
        }
      });
  };

  PurchaseOptions.prototype.guardClicks = function () {
    var self = this;

    if (!window.__jfPoAtcClickPatched) {
      window.__jfPoAtcClickPatched = true;
      document.addEventListener(
        'click',
        function (e) {
          if (!window.jfPurchaseOptions) return;
          var mainBtn = e.target.closest('#add-to-cart');
          var stickyBtn = e.target.closest('#corner-sticky-atc-cta-button');
          var trigger = mainBtn || stickyBtn;
          if (!trigger) return;
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          window.jfPurchaseOptions.runAddToCartFromUi(trigger);
        },
        true
      );
    }

    var form = document.getElementById('product-form');
    if (form && !form.__jfPoSubmitGuarded) {
      form.__jfPoSubmitGuarded = true;
      form.addEventListener(
        'submit',
        function (e) {
          e.preventDefault();
          e.stopPropagation();
          self.syncSellingPlanInput();
          self.runAddToCartFromUi(document.getElementById('add-to-cart'));
        },
        true
      );
    }
  };

  PurchaseOptions.prototype.syncSellingPlanInput = function () {
    var form = document.getElementById('product-form');
    var input = this.input;
    if ((!input || !input.isConnected) && form) {
      input = form.querySelector('[data-selling-plan-input]');
      if (!input) {
        input = document.createElement('input');
        input.type = 'hidden';
        input.setAttribute('data-selling-plan-input', '');
        input.setAttribute('data-jf-po-kept', 'true');
        form.appendChild(input);
      }
      this.input = input;
    }
    if (!input) return;

    var planId = this.getActivePlanId();
    if (this.mode === 'subscription' && planId) {
      input.disabled = false;
      input.removeAttribute('disabled');
      input.name = 'selling_plan';
      input.value = String(planId);
    } else {
      input.value = '';
      input.removeAttribute('name');
      input.disabled = true;
    }
  };

  PurchaseOptions.prototype.bind = function () {
    var self = this;

    this.root.querySelectorAll('[data-po-mode]').forEach(function (el) {
      el.addEventListener('click', function (e) {
        if (e.target.closest('[data-po-plan]')) return;
        var mode = el.getAttribute('data-po-mode');
        if (mode) self.applyMode(mode);
      });
      el.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          if (e.target.closest('[data-po-plan]')) return;
          e.preventDefault();
          var mode = el.getAttribute('data-po-mode');
          if (mode) self.applyMode(mode);
        }
      });
    });

    this.root.querySelectorAll('[data-po-plan]').forEach(function (pill) {
      pill.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        self.selectPlan(pill.getAttribute('data-po-plan'), pill);
      });
    });

    document.addEventListener('quantity:change', function () {
      self.updateAddToCartButton();
    });

    var idInput = document.querySelector('#product-form input[name="id"]');
    if (idInput) {
      idInput.addEventListener('change', function () {
        self.onVariantUpdated();
      });
      // Theme often sets input.value without firing change
      if (!idInput.__jfPoValuePatched) {
        idInput.__jfPoValuePatched = true;
        var desc = Object.getOwnPropertyDescriptor(
          HTMLInputElement.prototype,
          'value'
        );
        if (desc && desc.set) {
          Object.defineProperty(idInput, 'value', {
            configurable: true,
            enumerable: desc.enumerable,
            get: function () {
              return desc.get.call(this);
            },
            set: function (v) {
              var prev = desc.get.call(this);
              desc.set.call(this, v);
              if (String(prev) === String(v)) return;
              window.setTimeout(function () {
                var po = window.jfPurchaseOptions;
                if (!po || po._suppressVariantWatch || po._updatingUi) return;
                po.onVariantUpdated();
              }, 0);
            }
          });
        }
      }
    }

    document.addEventListener('variant:change', function () {
      self.onVariantUpdated();
    });

    document.addEventListener(
      'click',
      function (e) {
        if (!e.target.closest('variant-selector .variant-value')) return;
        self._preferCornerVariant = false;
        window.setTimeout(function () {
          self.onVariantUpdated();
        }, 0);
      },
      true
    );

    this.bindCornerStickyVariantSync();
  };

  PurchaseOptions.prototype.bindCornerStickyVariantSync = function () {
    var self = this;
    if (this.__cornerStickyBound) return;
    this.__cornerStickyBound = true;
    this._lastCornerSelectVal = '';

    function onCornerVariantChange(e) {
      if (self._suppressVariantWatch) return;
      var sel =
        (e && e.target) ||
        document.querySelector(
          '#corner-sticky-atc-select-0, select[id^="corner-sticky-atc-select"]'
        );
      var val = sel && sel.value != null ? String(sel.value) : '';
      if (val && val === self._lastCornerSelectVal) return;
      if (val) self._lastCornerSelectVal = val;

      self._preferCornerVariant = true;
      self.syncFormVariantFromCorner();
      self.onVariantUpdated();
    }

    function attachSelectListeners() {
      document
        .querySelectorAll(
          '#corner-sticky-atc-select-0, select[id^="corner-sticky-atc-select"]'
        )
        .forEach(function (sel) {
          if (sel.__jfPoCornerBound) return;
          sel.__jfPoCornerBound = true;
          if (!self._lastCornerSelectVal && sel.value) {
            self._lastCornerSelectVal = String(sel.value);
          }
          sel.addEventListener('change', onCornerVariantChange);
        });

      document
        .querySelectorAll(
          '#corner-sticky-atc-container input[type="number"], #corner-sticky-atc-outer-container input[type="number"]'
        )
        .forEach(function (input) {
          if (input.__jfPoCornerQtyBound) return;
          input.__jfPoCornerQtyBound = true;
          input.addEventListener('change', function () {
            if (self._updatingUi) return;
            var mainQty = document.getElementById('Quantity');
            if (mainQty && input.value && String(mainQty.value) !== String(input.value)) {
              mainQty.value = input.value;
            }
            self.updateAddToCartButton();
          });
        });
    }

    attachSelectListeners();

    // Only watch for Corner sticky being injected — do NOT react to our own CTA edits
    if (window.MutationObserver) {
      var t = null;
      new MutationObserver(function (mutations) {
        if (self._updatingUi || self._suppressVariantWatch) return;
        var relevant = false;
        for (var i = 0; i < mutations.length; i++) {
          var m = mutations[i];
          if (m.type !== 'childList') continue;
          var nodes = [];
          if (m.addedNodes && m.addedNodes.length) {
            for (var a = 0; a < m.addedNodes.length; a++) nodes.push(m.addedNodes[a]);
          }
          for (var n = 0; n < nodes.length; n++) {
            var node = nodes[n];
            if (node.nodeType !== 1) continue;
            if (
              (node.id && String(node.id).indexOf('corner-sticky-atc') === 0) ||
              (node.querySelector &&
                node.querySelector(
                  '#corner-sticky-atc-select-0, select[id^="corner-sticky-atc-select"], #corner-sticky-atc-container'
                ))
            ) {
              relevant = true;
              break;
            }
          }
          if (relevant) break;
        }
        if (!relevant) return;
        if (t) return;
        t = window.setTimeout(function () {
          t = null;
          attachSelectListeners();
        }, 150);
      }).observe(document.body, { childList: true, subtree: true });
    }
  };

  PurchaseOptions.prototype.getVariantId = function () {
    return String(this.resolveVariantId() || '');
  };

  PurchaseOptions.prototype.getCurrentPrices = function () {
    var vid = this.getVariantId();
    var entry = this.variantPlans[vid] || this.variantPlans[String(vid)] || {};
    var fallbackPrice = null;
    try {
      var vs = document.querySelector('variant-selector');
      if (vs && vs.currentVariant && vs.currentVariant.price != null) {
        fallbackPrice = Number(vs.currentVariant.price);
      }
    } catch (e) {}

    var oneTimePrice =
      entry.price != null ? Number(entry.price) : fallbackPrice;
    var oneTime = {
      price: oneTimePrice,
      price_display: entry.price_display || ''
    };
    if (!oneTime.price_display && oneTime.price != null && !isNaN(oneTime.price)) {
      oneTime.price_display = formatMoney(oneTime.price, this.currencySuffix);
    }
    var planId = this.getActivePlanId();
    var plansMap = entry.plans || {};
    var planEntry =
      plansMap[planId] ||
      plansMap[String(planId)] ||
      {};
    var subPrice =
      planEntry.price != null ? Number(planEntry.price) : oneTime.price;
    var subDisplay = planEntry.price_display || '';
    if (!subDisplay && subPrice != null && !isNaN(subPrice)) {
      subDisplay = formatMoney(subPrice, this.currencySuffix);
    }
    return {
      onetime: oneTime,
      subscription: {
        price: subPrice,
        price_display: subDisplay || oneTime.price_display
      }
    };
  };

  PurchaseOptions.prototype.refreshPrices = function () {
    var prices = this.getCurrentPrices();
    var oneEl = this.root.querySelector('[data-po-onetime-price]');
    var subEl = this.root.querySelector('[data-po-sub-price]');
    if (oneEl && prices.onetime.price_display) oneEl.textContent = prices.onetime.price_display;
    if (subEl && prices.subscription.price_display) subEl.textContent = prices.subscription.price_display;
    this.updateVariantUnitPrices();
  };

  PurchaseOptions.prototype.updateVariantUnitPrices = function () {
    var self = this;
    var planId = this.getActivePlanId();
    document.querySelectorAll('variant-selector .variant-value').forEach(function (li) {
      var unitEl = li.querySelector('.vv-peices[data-unit-price]');
      if (!unitEl) return;
      var vid = li.getAttribute('data-variant-id');
      var entry = self.variantPlans[vid] || self.variantPlans[String(vid)] || {};
      var baseUnit = entry.unit_price != null ? Number(entry.unit_price) : Number(unitEl.getAttribute('data-unit-price'));
      var unitRef =
        entry.unit_ref ||
        unitEl.getAttribute('data-unit-ref') ||
        'item';
      var symbol = unitEl.getAttribute('data-unit-symbol') || self.currencySuffix || '€';
      var cents = baseUnit;

      if (self.isSubscription() && planId && entry.plans) {
        var planEntry = entry.plans[planId] || entry.plans[String(planId)] || {};
        if (planEntry.unit_price != null) {
          cents = Number(planEntry.unit_price);
        } else if (
          planEntry.price != null &&
          entry.price &&
          baseUnit &&
          Number(entry.price) > 0
        ) {
          cents = Math.round((Number(planEntry.price) / Number(entry.price)) * baseUnit);
        }
      }

      if (!cents && cents !== 0) return;
      unitEl.setAttribute('data-unit-price', String(cents));
      unitEl.textContent = formatMoney(cents, symbol) + ' / ' + unitRef;
    });
  };

  PurchaseOptions.prototype.onVariantUpdated = function (variant) {
    var self = this;
    this._pendingVariant = variant;
    if (this._variantUpdateTimer) {
      window.clearTimeout(this._variantUpdateTimer);
    }
    // Debounce: theme fires updateFormID + updatePriceInstant + updateAddToCartButton
    // in one click — flush once with final variant state.
    this._variantUpdateTimer = window.setTimeout(function () {
      self._variantUpdateTimer = null;
      if (self._updatingUi) return;
      self._updatingUi = true;
      try {
        self.refreshPrices();
        self.updateAddToCartButton(self._pendingVariant);
      } finally {
        window.setTimeout(function () {
          self._updatingUi = false;
        }, 0);
      }
    }, 40);
  };

  PurchaseOptions.prototype.applyMode = function (mode, silent) {
    this.mode = mode === 'onetime' ? 'onetime' : 'subscription';
    this.root.querySelectorAll('[data-po-mode]').forEach(function (el) {
      var isActive = el.getAttribute('data-po-mode') === this.mode;
      el.classList.toggle('is-selected', isActive);
      el.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    }.bind(this));
    this.syncSellingPlanInput();
    if (this._updatingUi) {
      this.refreshPrices();
      this.updateAddToCartButton();
    } else {
      this.onVariantUpdated();
    }
    if (!silent) {
      document.dispatchEvent(
        new CustomEvent('purchase-options:change', {
          detail: { mode: this.mode, planId: this.getActivePlanId() }
        })
      );
    }
  };

  PurchaseOptions.prototype.selectPlan = function (planId, pillEl) {
    if (!planId) return;
    this.planId = planId;
    this.root.querySelectorAll('[data-po-plan]').forEach(function (pill) {
      var on = String(pill.getAttribute('data-po-plan')) === String(planId);
      pill.classList.toggle('is-selected', on);
      pill.setAttribute('aria-checked', on ? 'true' : 'false');
    });
    if (pillEl) {
      var weeks = pillEl.getAttribute('data-po-weeks');
      var label =
        pillEl.getAttribute('data-po-plan-label') || pillEl.textContent.trim();
      if (isDirtyLabel(label)) {
        label = cleanFrequencyLabel(label, weeks);
        pillEl.setAttribute('data-po-plan-label', label);
        pillEl.textContent = label;
      }
      this.planLabel = label;
    }
    this.applyMode('subscription');
    this.refreshPrices();
  };

  PurchaseOptions.prototype.isSubscription = function () {
    return this.mode === 'subscription';
  };

  PurchaseOptions.prototype.getUnitPriceCents = function () {
    var prices = this.getCurrentPrices();
    var cents =
      this.mode === 'subscription'
        ? Number(prices.subscription.price)
        : Number(prices.onetime.price);
    if (!cents || isNaN(cents)) return 0;
    return cents;
  };

  PurchaseOptions.prototype.getCtaCopy = function () {
    var qtyInput = document.getElementById('Quantity');
    var qty = parseInt(qtyInput && qtyInput.value, 10) || 1;
    var cents = this.getUnitPriceCents() * qty;
    var priceText =
      cents > 0
        ? formatMoney(cents, this.currencySuffix)
        : '';
    var addLabel =
      (window.themeStrings && window.themeStrings.addToCart) ||
      STRINGS.addToCart ||
      'Add to Cart';

    if (this.mode === 'subscription') {
      var freq = this.planLabel || '';
      if (isDirtyLabel(freq)) {
        var sel = this.root.querySelector('.jf-po__pill.is-selected');
        freq = cleanFrequencyLabel(freq, sel && sel.getAttribute('data-po-weeks'));
        this.planLabel = freq;
      }
      var subscribeWord = STRINGS.subscribe || 'Subscribe';
      return {
        mode: 'subscription',
        priceText: priceText,
        full: priceText
          ? freq
            ? subscribeWord + ' · ' + priceText + ' / ' + freq
            : subscribeWord + ' · ' + priceText
          : subscribeWord,
        label: subscribeWord
      };
    }

    return {
      mode: 'onetime',
      priceText: priceText,
      full: priceText ? addLabel + ' - ' + priceText : addLabel,
      label: addLabel
    };
  };

  PurchaseOptions.prototype.setButtonCopy = function (btn, copy) {
    if (!btn || !copy || btn.id !== 'add-to-cart') return;
    var label = btn.querySelector('.btn-label');
    var priceEl = btn.querySelector('.btn-price');
    var separatorEl = btn.querySelector('.btn-separator');
    if (!(label || priceEl)) return;

    btn.querySelectorAll('s, del, strike').forEach(function (el) {
      var text = document.createTextNode(el.textContent || '');
      if (el.parentNode) el.parentNode.replaceChild(text, el);
    });

    // Always write the full CTA into .btn-label so price cannot go missing
    // when .btn-price is hidden/cleared by a previous subscription state.
    if (label) {
      label.textContent = copy.full;
      label.style.textDecoration = 'none';
    }
    if (priceEl) {
      priceEl.textContent = '';
      priceEl.style.display = 'none';
    }
    if (separatorEl) separatorEl.style.display = 'none';
  };

  PurchaseOptions.prototype.syncCornerStickyCta = function (copy) {
    if (!copy) return;
    var cta = document.getElementById('corner-sticky-atc-cta-button');
    if (!cta) return;

    var labeled = cta.querySelector('[data-jf-po-corner-label]');
    if (labeled && labeled.textContent === copy.full && cta.childElementCount === 1) {
      return;
    }

    var ownedLock = !this._updatingUi;
    if (ownedLock) this._updatingUi = true;
    try {
      cta.querySelectorAll('s, del, strike').forEach(function (el) {
        var text = document.createTextNode(el.textContent || '');
        if (el.parentNode) el.parentNode.replaceChild(text, el);
      });

      if (!labeled) {
        labeled = document.createElement('span');
        labeled.setAttribute('data-jf-po-corner-label', '');
        while (cta.firstChild) cta.removeChild(cta.firstChild);
        cta.appendChild(labeled);
      } else {
        Array.prototype.slice.call(cta.childNodes).forEach(function (node) {
          if (node !== labeled) cta.removeChild(node);
        });
      }

      labeled.style.textDecoration = 'none';
      if (labeled.textContent !== copy.full) labeled.textContent = copy.full;
      cta.style.textDecoration = 'none';
    } finally {
      if (ownedLock) {
        var self = this;
        window.setTimeout(function () {
          self._updatingUi = false;
        }, 0);
      }
    }
  };

  PurchaseOptions.prototype.updateAddToCartButton = function (variant) {
    var btn = document.getElementById('add-to-cart');
    if (variant && variant.available === false) return;
    if (btn && btn.classList.contains('out-of-stock')) return;
    this.syncSellingPlanInput();
    var copy = this.getCtaCopy();
    this._lastCtaCopy = copy;
    if (btn) this.setButtonCopy(btn, copy);
    this.syncCornerStickyCta(copy);
  };

  function activateVariant() {
    if (activated) return;
    var root = document.querySelector('[data-purchase-options]');
    if (!root) return;

    activated = true;
    hideAppstleWidgets();
    window.jfPurchaseOptions = new PurchaseOptions(root);

    var hideTimer = null;
    new MutationObserver(function () {
      if (!isVariantB()) return;
      var po = window.jfPurchaseOptions;
      if (po && (po._updatingUi || po._suppressVariantWatch)) return;
      if (hideTimer) return;
      hideTimer = window.setTimeout(function () {
        hideTimer = null;
        if (!isVariantB()) return;
        var po2 = window.jfPurchaseOptions;
        if (po2 && (po2._updatingUi || po2._suppressVariantWatch)) return;
        hideAppstleWidgets();
        if (po2 && po2._lastCtaCopy) {
          po2.syncCornerStickyCta(po2._lastCtaCopy);
        }
      }, 300);
    }).observe(document.body, { childList: true, subtree: true });

    function patchVariantSelector() {
      var Ctor = customElements.get('variant-selector');
      if (!Ctor || Ctor.prototype.__jfPoPatched) return;
      var methods = [
        'updateAddToCartButton',
        'updatePriceInstant',
        'updatePrices',
        'updateFormID'
      ];
      methods.forEach(function (name) {
        var original = Ctor.prototype[name];
        if (typeof original !== 'function') return;
        Ctor.prototype[name] = function () {
          var result = original.apply(this, arguments);
          if (window.jfPurchaseOptions && isVariantB()) {
            window.jfPurchaseOptions.onVariantUpdated(this.currentVariant);
          }
          return result;
        };
      });
      Ctor.prototype.__jfPoPatched = true;
    }
    patchVariantSelector();
    customElements.whenDefined('variant-selector').then(patchVariantSelector);
  }

  function applyAbState() {
    syncAbAttributeFromUrl();
    if (isVariantB()) {
      activateVariant();
    } else {
      neutralizeCustomInputs();
    }
  }

  function watchBodyAttribute() {
    if (!document.body || !window.MutationObserver) return;
    new MutationObserver(function () {
      applyAbState();
    }).observe(document.body, {
      attributes: true,
      attributeFilter: [BODY_ATTR]
    });
  }

  function init() {
    if (!document.querySelector('[data-purchase-options]')) return;
    applyAbState();
    watchBodyAttribute();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
