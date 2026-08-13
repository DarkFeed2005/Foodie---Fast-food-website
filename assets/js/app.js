'use strict';

/**
 * Foodie frontend <-> NestJS backend integration.
 * Loaded after script.js; extends the static site with real API data.
 */

const API_BASE = window.FOODIE_API_URL || 'http://localhost:3001';
const API_PREFIX = '/api/v1';
const CART_KEY = 'foodie_cart_v1';

const state = {
  categories: [],
  products: [],
  featured: [],
  currentFilter: 'all',
  currentSearch: '',
  cart: loadCart(),
  page: 1,
};

const $ = (sel, root) => (root || document).querySelector(sel);
const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

function money(n) {
  return '$' + Number(n || 0).toFixed(2);
}

function fullImage(path) {
  if (!path) return '';
  if (/^(https?:)?\/\//.test(path)) return path;
  return API_BASE + (path.startsWith('/') ? path : '/' + path);
}

function escapeHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function api(path, options) {
  let res;
  try {
    res = await fetch(API_BASE + API_PREFIX + path, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
  } catch (e) {
    const err = new ApiError(
      'Cannot reach the server. Is the backend running on ' + API_BASE + '?',
      0
    );
    err.network = true;
    throw err;
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.success === false) {
    throw new ApiError(body.message || 'Request failed (' + res.status + ')', res.status);
  }
  return body.data;
}

function formatDate(input) {
  const d = new Date(input);
  if (isNaN(d.getTime())) return String(input || '');
  return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
}

/* ------------------------------ toasts ------------------------------ */

const toastContainer = $('[data-toast-container]');

function toast(message, type) {
  const el = document.createElement('div');
  el.className = 'toast ' + (type || '');
  const icon = type === 'error' ? 'close-circle' : type === 'success' ? 'checkmark-circle' : 'information-circle';
  el.innerHTML =
    '<ion-icon name="' + icon + '"></ion-icon><p>' + escapeHtml(message) + '</p>';
  toastContainer.appendChild(el);
  setTimeout(() => {
    el.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
    el.style.opacity = '0';
    el.style.transform = 'translateY(10px)';
    setTimeout(() => el.remove(), 300);
  }, 4200);
}

/* ------------------------------ modals ------------------------------ */

function openModal(overlay) {
  overlay.classList.add('active');
  document.body.classList.add('no-scroll');
}

function closeModal(overlay) {
  overlay.classList.remove('active');
  if (!$('.modal-overlay.active, .cart-drawer.active')) {
    document.body.classList.remove('no-scroll');
  }
}

function bindModal(overlay) {
  const closeBtn = $('[data-modal-close]', overlay);
  if (closeBtn) closeBtn.addEventListener('click', () => closeModal(overlay));
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal(overlay);
  });
}

/* --------------------------- API availability --------------------------- */

const noticeEl = $('[data-api-notice]');

async function guard(fn) {
  try {
    return await fn();
  } catch (err) {
    console.error('[foodie]', err);
    state.lastError = err.message || 'Something went wrong.';
    if (err.network) noticeEl.classList.add('active');
    toast(state.lastError, 'error');
    return null;
  }
}

/* ------------------------------ cart ------------------------------ */

function loadCart() {
  try {
    return JSON.parse(localStorage.getItem(CART_KEY)) || [];
  } catch (e) {
    return [];
  }
}

function saveCart() {
  localStorage.setItem(CART_KEY, JSON.stringify(state.cart));
  updateCartCount();
}

function updateCartCount() {
  const count = state.cart.reduce((t, i) => t + i.quantity, 0);
  $$('[data-cart-count]').forEach((el) => (el.textContent = count));
}

function cartProduct(id) {
  return state.products.find((p) => p.id === id);
}

function addToCart(product, quantity) {
  if (!product.isAvailable) {
    toast('"' + product.name + '" is currently sold out.', 'error');
    return;
  }
  const existing = state.cart.find((i) => i.productId === product.id);
  if (existing) {
    existing.quantity += quantity || 1;
  } else {
    state.cart.push({ productId: product.id, quantity: quantity || 1 });
  }
  saveCart();
  renderCart();
  toast('Added to cart: ' + product.name, 'success');
}

function cartTotal() {
  return state.cart.reduce((t, i) => {
    const p = cartProduct(i.productId);
    return t + (p ? p.price : 0) * i.quantity;
  }, 0);
}

function renderCart() {
  const body = $('[data-cart-body]');
  const Summary = $('[data-cart-summary]');
  const itemsEl = $('[data-cart-items]', body);

  if (!state.cart.length) {
    itemsEl.innerHTML =
      '<p class="cart-empty"><ion-icon name="bag-handle-outline"></ion-icon><br>Your cart is empty.<br>Try our delicious foods!</p>';
    Summary.classList.add('hidden');
    return;
  }
  Summary.classList.remove('hidden');

  itemsEl.innerHTML = state.cart
    .map((item) => {
      const p = cartProduct(item.productId);
      if (!p) return '';
      return (
        '<div class="cart-item">' +
        '<img src="' + fullImage(p.image) + '" alt="' + escapeHtml(p.name) + '">' +
        '<div class="cart-item-info">' +
        '<p class="cart-item-name">' + escapeHtml(p.name) + '</p>' +
        '<p class="cart-item-price">' + money(p.price) +
        (p.oldPrice && p.oldPrice > p.price ? '<span class="cart-item-old">' + money(p.oldPrice) + '</span>' : '') +
        '</p></div>' +
        '<div class="qty-control">' +
        '<button type="button" data-cart-dec="' + p.id + '" aria-label="Decrease">-</button>' +
        '<span>' + item.quantity + '</span>' +
        '<button type="button" data-cart-inc="' + p.id + '" aria-label="Increase">+</button>' +
        '</div>' +
        '<button type="button" class="cart-item-remove" data-cart-remove="' + p.id + '" aria-label="Remove">' +
        '<ion-icon name="trash-outline"></ion-icon></button>' +
        '</div>'
      );
    })
    .join('');

  const qty = state.cart.reduce((t, i) => t + i.quantity, 0);
  $('[data-cart-total]').innerHTML =
    money(cartTotal()) + '<small>' + qty + ' item(s) &middot; delivery + $2.50</small>';
}

function openCart() {
  if (!state.products.length) {
    toast('Menu is loading, try again in a moment.', 'error');
    return;
  }
  renderCart();
  $('[data-cart-drawer]').classList.add('active');
  document.body.classList.add('no-scroll');
}

function closeCart() {
  $('[data-cart-drawer]').classList.remove('active');
  if (!$('.modal-overlay.active, .cart-drawer.active')) {
    document.body.classList.remove('no-scroll');
  }
}

/* ------------------------------ promo ------------------------------ */

function renderPromo() {
  const list = $('[data-promo-list]');
  if (!list) return;
  list.innerHTML = state.featured
    .map(
      (p) =>
        '<li class="promo-item"><div class="promo-card" tabindex="0" data-add="' + p.id + '" role="button" ' +
        'aria-label="Add ' + escapeHtml(p.name) + ' to cart">' +
        '<div class="card-icon"><ion-icon name="restaurant-outline"></ion-icon></div>' +
        '<h3 class="h3 card-title">' + escapeHtml(p.name) + '</h3>' +
        '<p class="card-text">' + escapeHtml(p.description || '') + '</p>' +
        '<span class="promo-add"><ion-icon name="cart-outline"></ion-icon> Add to cart &middot; ' + money(p.price) + '</span>' +
        '<img src="' + fullImage(p.image) + '" width="300" height="300" loading="lazy" alt="' + escapeHtml(p.name) +
        '" class="w-100 card-banner"></div></li>'
    )
    .join('');
}

async function loadCategories() {
  const data = await guard(() => api('/categories'));
  if (!data) return;
  state.categories = data;
  state.categoryById = {};
  data.forEach((c) => (state.categoryById[c.id] = c));
  renderFilters();
  noticeEl.classList.remove('active');
}

/* ------------------------------ food menu ------------------------------ */

function renderFilters() {
  const list = $('[data-filter-list]');
  if (!list) return;
  list.innerHTML =
    '<li><button type="button" class="filter-btn ' + (state.currentFilter === 'all' ? 'active' : '') + '" data-filter="all">All</button></li>' +
    state.categories
      .map(
        (c) =>
          '<li><button type="button" class="filter-btn ' +
          (state.currentFilter === c.slug ? 'active' : '') + '" data-filter="' + c.slug + '">' +
          escapeHtml(c.name) + '</button></li>'
      )
      .join('');
}

function renderMenu() {
  const list = $('[data-menu-list]');
  if (!list) return;
  list.innerHTML = state.products
    .map((p) => {
      const off = p.oldPrice && p.oldPrice > p.price;
      const delta = off ? Math.round(((p.oldPrice - p.price) / p.oldPrice) * 100) : 0;
      const stars = Math.max(1, Math.round(p.rating || 5));
      let starsHtml = '';
      for (let i = 1; i <= 5; i++) {
        starsHtml += '<ion-icon name="' + (i <= stars ? 'star' : 'star-outline') + '"></ion-icon>';
      }
      const soldOut = !p.isAvailable;
      return (
        '<li><div class="menu-card">' +
        '<div class="menu-card-banner">' +
        (off && !soldOut ? '<span class="menu-card-badge">-' + delta + '%</span>' : '') +
        '<img src="' + fullImage(p.image) + '" width="300" height="300" loading="lazy" alt="' +
        escapeHtml(p.name) + '" class="w-100">' +
        (soldOut ? '<div class="menu-card-soldout">Sold Out</div>' : '') +
        '</div>' +
        '<div class="menu-card-body">' +
        '<div class="menu-card-meta">' +
        '<p class="menu-card-cat">' + escapeHtml((p.category && p.category.name) || (state.categoryById[p.categoryId] || {}).name || '') + '</p>' +
        '<span class="rating-stars">' + starsHtml + '</span>' +
        '</div>' +
        '<h3 class="menu-card-title">' + escapeHtml(p.name) + '</h3>' +
        '<p class="menu-card-price">' + money(p.price) +
        (off ? '<span class="menu-card-old">' + money(p.oldPrice) + '</span>' : '') + '</p>' +
        '<button type="button" class="btn menu-card-btn" data-add="' + p.id + '"' + (soldOut ? ' disabled' : '') + '>' +
        (soldOut ? 'Unavailable' : 'Order Now') + '</button>' +
        '</div></div></li>'
      );
    })
    .join('');
}

function showMenuLoading() {
  const list = $('[data-menu-list]');
  if (list) {
    list.innerHTML = '<li class="menu-loading"><div class="spinner"></div>Loading menu\u2026</li>';
  }
}

async function loadProducts() {
  const params = new URLSearchParams({ page: 1, limit: 24, sort: 'popular' });
  if (state.currentFilter !== 'all') params.set('categorySlug', state.currentFilter);
  if (state.currentSearch) params.set('search', state.currentSearch);
  showMenuLoading();
  const data = await guard(() => api('/products?' + params.toString()));
  if (!data) return;
  state.products = data.items || data || [];
  renderMenu();
  noticeEl.classList.remove('active');
}

async function refreshAll() {
  await loadCategories();
  await Promise.all([
    loadFeatured(),
    loadProducts(),
    loadBlogs(),
    loadTestimonials(),
  ]);
}

async function loadFeatured() {
  const data = await guard(() => api('/products?isFeatured=true&limit=5'));
  if (!data) return;
  state.featured = data.items || data || [];
  renderPromo();
  noticeEl.classList.remove('active');
}

/* ------------------------------ testimonials ------------------------------ */

function renderTestimonials() {
  const list = $('[data-testi-list]');
  if (!list) return;
  list.innerHTML = state.testimonials
    .map((t) => {
      const stars = Math.max(1, Math.round(t.rating || 5));
      let starsHtml = '';
      for (let i = 1; i <= 5; i++) {
        starsHtml += '<ion-icon name="' + (i <= stars ? 'star' : 'star-outline') + '"></ion-icon>';
      }
      return (
        '<li class="testi-item"><div class="testi-card">' +
        '<div class="profile-wrapper">' +
        '<figure class="avatar"><img src="' + fullImage(t.avatar) + '" width="80" height="80" loading="lazy" alt="' +
        escapeHtml(t.name) + '"></figure>' +
        '<div><h3 class="h4 testi-name">' + escapeHtml(t.name) + '</h3>' +
        '<p class="testi-title">' + escapeHtml(t.title || '') + '</p></div>' +
        '</div>' +
        '<blockquote class="testi-text">"' + escapeHtml(t.content) + '"</blockquote>' +
        '<div class="rating-wrapper">' + starsHtml + '</div>' +
        '</div></li>'
      );
    })
    .join('');
}

async function loadTestimonials() {
  state.testimonials = await guard(() => api('/testimonials')) || [];
  renderTestimonials();
}

/* ------------------------------ blog ------------------------------ */

function renderBlogs() {
  const list = $('[data-blog-list]');
  if (!list) return;
  list.innerHTML = state.blogs
    .map(
      (b) =>
        '<li><div class="blog-card">' +
        '<div class="card-banner">' +
        '<img src="' + fullImage(b.image) + '" width="600" height="390" loading="lazy" alt="' + escapeHtml(b.title) +
        '" class="w-100">' +
        '<div class="badge">' + escapeHtml(b.category) + '</div>' +
        '</div>' +
        '<div class="card-content">' +
        '<div class="card-meta-wrapper">' +
        '<span class="card-meta-link"><ion-icon name="calendar-outline"></ion-icon>' +
        '<time class="meta-info" datetime="' + escapeHtml(b.publishedAt) + '">' + formatDate(b.publishedAt) + '</time></span>' +
        '<span class="card-meta-link"><ion-icon name="person-outline"></ion-icon>' +
        '<p class="meta-info">' + escapeHtml(b.author) + '</p></span>' +
        '</div>' +
        '<h3 class="h3"><a href="#" class="card-title" data-read-more="' + b.slug + '">' + escapeHtml(b.title) + '</a></h3>' +
        '<p class="card-text">' + escapeHtml(b.excerpt) + '</p>' +
        '<a href="#" class="btn-link" data-read-more="' + b.slug + '"><span>Read More</span>' +
        '<ion-icon name="arrow-forward" aria-hidden="true"></ion-icon></a>' +
        '</div></div></li>'
    )
    .join('');
}

async function loadBlogs() {
  const data = await guard(() => api('/blogs'));
  if (!data) return;
  state.blogs = data.items || data || [];
  renderBlogs();
}

function openBlog(slug) {
  const blog = state.blogs.find((b) => b.slug === slug);
  if (!blog) return;
  const overlay = $('[data-blog-modal]');
  const target = $('[data-blog-content]', overlay);
  target.innerHTML =
    '<img src="' + fullImage(blog.image) + '" loading="lazy" alt="' + escapeHtml(blog.title) +
    '" class="blog-modal-banner">' +
    '<div class="blog-modal-meta">' +
    '<span><ion-icon name="calendar-outline"></ion-icon>' + formatDate(blog.publishedAt) + '</span>' +
    '<span><ion-icon name="person-outline"></ion-icon>' + escapeHtml(blog.author) + '</span>' +
    (Number(blog.views) ? '<span><ion-icon name="eye-outline"></ion-icon>' + blog.views + ' views</span>' : '') +
    '</div>' +
    '<h3>' + escapeHtml(blog.title) + '</h3>' +
    '<div class="blog-content">' + blog.content + '</div>';
  openModal(overlay);
}

/* ------------------------------ checkout ------------------------------ */

function openCheckout() {
  if (!state.cart.length) {
    toast('Your cart is empty.', 'error');
    return;
  }
  renderCheckoutSummary();
  $('[data-checkout-modal]').classList.add('active');
  document.body.classList.add('no-scroll');
}

function renderCheckoutSummary() {
  const itemsEl = $('[data-checkout-items]');
  const total = cartTotal();
  itemsEl.innerHTML = state.cart
    .map((item) => {
      const p = cartProduct(item.productId);
      if (!p) return '';
      return (
        '<div class="cart-item">' +
        '<img src="' + fullImage(p.image) + '" alt="">' +
        '<div class="cart-item-info"><p class="cart-item-name">' + escapeHtml(p.name) + '</p>' +
        '<p class="cart-item-price">' + item.quantity + ' &times; ' + money(p.price) + '</p></div>' +
        '<p class="cart-item-name">' + money(p.price * item.quantity) + '</p></div>'
      );
    })
    .join('');
  $('[data-checkout-subtotal]').textContent = money(total);
  $('[data-checkout-delivery]').textContent = money(2.5);
  $('[data-checkout-total]').textContent = money(total + 2.5);
}

async function placeOrder(form) {
  const btn = $('[data-place-order-btn]');
  const err = $('[data-checkout-error]');
  err.classList.remove('active');
  if (!state.cart.length) {
    err.textContent = 'Your cart is empty.';
    err.classList.add('active');
    return;
  }
  const fd = new FormData(form);
  const payload = {
    customerName: String(fd.get('customerName') || '').trim(),
    customerEmail: String(fd.get('email') || '').trim(),
    customerPhone: String(fd.get('phone') || '').trim(),
    address: String(fd.get('address') || '').trim(),
    note: String(fd.get('note') || '').trim() || undefined,
    paymentMethod: String(fd.get('paymentMethod') || 'cash_on_delivery'),
    items: state.cart.map((i) => ({ productId: i.productId, quantity: i.quantity })),
  };
  btn.disabled = true;
  btn.textContent = 'Placing order\u2026';
  const data = await guard(() =>
    api('/orders', { method: 'POST', body: JSON.stringify(payload) })
  );
  btn.disabled = false;
  btn.textContent = 'Place Order';
  if (!data) return;
  state.cart = [];
  saveCart();
  renderCart();
  closeCart();
  const overlay = $('[data-checkout-modal]');
  closeModal(overlay);
  form.reset();
  const order = data.order || data;
  setTimeout(() => {
    toast('Order placed! Your order number is ' + order.orderNumber + '.', 'success');
  }, 250);
}

/* ------------------------------ reservation ------------------------------ */

function openReservation() {
  $('[data-reservation-modal]').classList.add('active');
  document.body.classList.add('no-scroll');
}

async function submitReservation(form, successEl, errorEl) {
  const clearError = () => errorEl && errorEl.classList.remove('active');
  clearError();
  const fd = new FormData(form);
  const payload = {
    fullName: String(fd.get('fullName') || fd.get('full_name') || '').trim(),
    email: String(fd.get('email') || fd.get('email_address') || '').trim(),
    phone: String(fd.get('phone') || '').trim() || undefined,
    totalPerson: String(fd.get('totalPerson') || fd.get('total_person') || '2 person'),
    bookingDate: String(fd.get('bookingDate') || fd.get('booking_date') || ''),
    bookingTime: String(fd.get('bookingTime') || fd.get('booking_time') || '').trim() || undefined,
    message: String(fd.get('message') || '').trim() || undefined,
  };
  const submitBtn = form.querySelector('button[type="submit"]');
  const original = submitBtn ? submitBtn.innerHTML : '';
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Booking\u2026';
  }
  const data = await guard(() =>
    api('/reservations', { method: 'POST', body: JSON.stringify(payload) })
  );
  if (submitBtn) {
    submitBtn.disabled = false;
    submitBtn.innerHTML = original;
  }
  if (!data) {
    if (errorEl) {
      errorEl.textContent = state.lastError || 'Booking failed. Please try again.';
      errorEl.classList.add('active');
    }
    return;
  }
  form.reset();
  const booking = data.reservation || data;
  if (successEl) {
    successEl.innerHTML =
      '<b>Table booked!</b> Your booking number is <b>' + escapeHtml(booking.bookingNumber) +
      '</b>. We look forward to seeing you.';
    successEl.classList.add('active');
    setTimeout(() => successEl.classList.remove('active'), 12000);
  }
  toast('Table booked! Booking number: ' + booking.bookingNumber + '.', 'success');
}

/* ------------------------------ events ------------------------------ */

function bindEvents() {
  document.addEventListener('click', (e) => {
    const addBtn = e.target.closest('[data-add]');
    if (addBtn) {
      const p = cartProduct(addBtn.getAttribute('data-add'));
      if (p) addToCart(p);
      return;
    }
    const minus = e.target.closest('[data-cart-dec]');
    if (minus) {
      const id = minus.getAttribute('data-cart-dec');
      const item = state.cart.find((i) => i.productId === id);
      if (item) {
        item.quantity -= 1;
        if (item.quantity < 1) state.cart = state.cart.filter((i) => i.productId !== id);
        saveCart();
        renderCart();
      }
      return;
    }
    const plus = e.target.closest('[data-cart-inc]');
    if (plus) {
      const id = plus.getAttribute('data-cart-inc');
      const item = state.cart.find((i) => i.productId === id);
      if (item) {
        item.quantity += 1;
        saveCart();
        renderCart();
      }
      return;
    }
    const remove = e.target.closest('[data-cart-remove]');
    if (remove) {
      const id = remove.getAttribute('data-cart-remove');
      state.cart = state.cart.filter((i) => i.productId !== id);
      saveCart();
      renderCart();
      return;
    }
    const readMore = e.target.closest('[data-read-more]');
    if (readMore) {
      e.preventDefault();
      openBlog(readMore.getAttribute('data-read-more'));
    }
  });

  const filterList = $('[data-filter-list]');
  if (filterList) {
    filterList.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-filter]');
      if (!btn) return;
      state.currentFilter = btn.getAttribute('data-filter');
      renderFilters();
      loadProducts();
    });
  }

  const cartBtn = $('[data-cart-btn]');
  if (cartBtn) cartBtn.addEventListener('click', openCart);

  const cartClose = $('[data-cart-close]');
  if (cartClose) cartClose.addEventListener('click', closeCart);

  const checkoutBtn = $('[data-checkout-btn]');
  if (checkoutBtn) checkoutBtn.addEventListener('click', openCheckout);

  const reservationBtns = $$('[data-reservation-open]');
  reservationBtns.forEach((btn) => btn.addEventListener('click', openReservation));

  const reservationModal = $('[data-reservation-modal]');
  const reservationForm = $('[data-reservation-form]');
  if (reservationModal && reservationForm) {
    bindModal(reservationModal);
    reservationForm.addEventListener('submit', (e) => {
      e.preventDefault();
      submitReservation(
        reservationForm,
        $('[data-reservation-success]', reservationModal),
        $('[data-reservation-error]', reservationModal)
      );
    });
  }

  const footerForm = $('[data-footer-booking-form]');
  if (footerForm) {
    footerForm.addEventListener('submit', (e) => {
      e.preventDefault();
      submitReservation(footerForm, $('[data-footer-booking-result]'));
    });
  }

  const checkoutForm = $('[data-checkout-form]');
  if (checkoutForm) {
    checkoutForm.addEventListener('submit', (e) => {
      e.preventDefault();
      placeOrder(checkoutForm);
    });
  }
  const checkoutModal = $('[data-checkout-modal]');
  if (checkoutModal) bindModal(checkoutModal);

  const blogModal = $('[data-blog-modal]');
  if (blogModal) bindModal(blogModal);

  const searchInput = $('.search-input');
  const searchSubmitBtn = $('[data-search-submit-btn]');
  if (searchInput && searchSubmitBtn) {
    const runSearch = () => {
      const term = searchInput.value.trim();
      if (!term) {
        toast('Type something to search.', 'error');
        return;
      }
      state.currentSearch = term;
      state.currentFilter = 'all';
      renderFilters();
      loadProducts();
      searchInput.value = '';
      const container = $('[data-search-container]');
      if (container && container.classList.contains('active')) {
        container.classList.remove('active');
        document.body.classList.remove('active');
      }
      $('[data-menu-scroll]').scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    searchSubmitBtn.addEventListener('click', runSearch);
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') runSearch();
    });
  }

  $$('.order-now-scroll').forEach((btn) =>
    btn.addEventListener('click', () =>
      $('[data-menu-scroll]').scrollIntoView({ behavior: 'smooth', block: 'start' })
    )
  );

  const retryBtn = $('[data-retry-btn]');
  if (retryBtn) retryBtn.addEventListener('click', refreshAll);
}

/* ------------------------------ init ------------------------------ */

document.addEventListener('DOMContentLoaded', function () {
  bindEvents();
  updateCartCount();
  refreshAll();
});