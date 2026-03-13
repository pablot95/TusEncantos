document.addEventListener('DOMContentLoaded', () => {

    const loader = document.getElementById('loader');
    window.addEventListener('load', () => {
        setTimeout(() => loader.classList.add('hidden'), 800);
    });

    const cursorGlow = document.getElementById('cursor-glow');
    if (window.matchMedia('(hover: hover)').matches) {
        document.addEventListener('mousemove', e => {
            cursorGlow.style.left = e.clientX + 'px';
            cursorGlow.style.top = e.clientY + 'px';
        });
    }

    const navbar = document.getElementById('navbar');
    const logoFloat = document.querySelector('.nav-logo-float');
    let lastScroll = 0;
    window.addEventListener('scroll', () => {
        const scrollY = window.scrollY;
        navbar.classList.toggle('scrolled', scrollY > 60);
        if (logoFloat) logoFloat.classList.toggle('shrink', scrollY > 60);
        lastScroll = scrollY;
    }, { passive: true });

    const menuToggle = document.getElementById('menu-toggle');
    const mobileMenu = document.getElementById('mobile-menu');
    menuToggle.addEventListener('click', () => {
        menuToggle.classList.toggle('active');
        mobileMenu.classList.toggle('open');
    });
    mobileMenu.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
            menuToggle.classList.remove('active');
            mobileMenu.classList.remove('open');
        });
    });

    const reveals = document.querySelectorAll('.reveal');
    const revealObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                revealObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

    reveals.forEach(el => revealObserver.observe(el));

    // --- Cargar productos desde Firebase ---
    let allProducts = [];
    let activeCategory = 'all';

    const productsGrid = document.getElementById('products-grid');
    const productsLoading = document.getElementById('products-loading');
    const filterCategoriesList = document.getElementById('filter-categories');

    // Construir lista de categorías inmediatamente (no depende de Firebase)
    function buildCategoryFilters() {
        filterCategoriesList.innerHTML = '<li><button class="filter-btn active" data-category="all">Todos</button></li>';
        CATEGORIES.forEach(cat => {
            const li = document.createElement('li');
            li.innerHTML = `<button class="filter-btn" data-category="${cat}">${cat}</button>`;
            filterCategoriesList.appendChild(li);
        });
        setupFilterListeners();
    }
    buildCategoryFilters();

    // Mobile: toggle filter groups
    document.querySelectorAll('.filter-group h3').forEach(h3 => {
        h3.addEventListener('click', () => {
            h3.parentElement.classList.toggle('open');
        });
    });

    async function loadProducts() {
        try {
            const snapshot = await db.collection('products').get();
            allProducts = [];

            snapshot.forEach(doc => {
                const data = doc.data();
                data._id = doc.id;
                allProducts.push(data);
            });

            renderProducts();
        } catch (err) {
            if (productsLoading) {
                productsLoading.innerHTML = '<p style="color:#999">Error al cargar productos</p>';
            }
        }
    }

    function renderProducts() {
        if (productsLoading) productsLoading.style.display = 'none';
        productsGrid.querySelectorAll('.product-card').forEach(el => el.remove());

        let filtered = allProducts;
        if (activeCategory !== 'all') {
            filtered = filtered.filter(p => p.category === activeCategory);
        }

        if (filtered.length === 0) {
            const emptyMsg = document.createElement('p');
            emptyMsg.className = 'product-card products-empty-msg';
            emptyMsg.textContent = 'No se encontraron productos con estos filtros.';
            emptyMsg.style.cssText = 'text-align:center;color:#999;padding:40px 0;grid-column:1/-1;font-size:.9rem';
            productsGrid.appendChild(emptyMsg);
            return;
        }

        filtered.forEach(p => {
            const article = document.createElement('article');
            article.className = 'product-card reveal visible';
            article.dataset.category = p.category;
            const mainImg = (p.images && p.images.length > 0) ? p.images[0] : (p.image || '');
            article.innerHTML = `
                <a href="producto.html?id=${encodeURIComponent(p._id)}" class="product-link">
                    <div class="product-img-wrap">
                        <img src="${escapeAttr(mainImg)}" alt="${escapeAttr(p.name)}" width="400" height="500" loading="lazy">
                        <div class="product-overlay">
                            <span>Ver Detalle</span>
                        </div>
                    </div>
                    <div class="product-info">
                        <span class="product-tag">${escapeHtml(p.category)}</span>
                        <h3>${escapeHtml(p.name)}</h3>
                        <p class="product-price">$${p.price.toLocaleString('es-AR')}</p>
                        ${(p.stock != null && p.stock > 0 && p.stock < 5) ? '<span class="low-stock-tag">¡Últimas unidades!</span>' : ''}
                    </div>
                </a>
            `;
            productsGrid.appendChild(article);
        });
    }

    function setupFilterListeners() {
        // Category filters
        filterCategoriesList.addEventListener('click', (e) => {
            const btn = e.target.closest('.filter-btn');
            if (!btn) return;
            filterCategoriesList.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            activeCategory = btn.dataset.category;
            renderProducts();
        });

        // Size filters removed

        // Clear filters
        document.getElementById('filter-clear').addEventListener('click', () => {
            activeCategory = 'all';
            filterCategoriesList.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            filterCategoriesList.querySelector('[data-category="all"]').classList.add('active');
            renderProducts();
        });
    }

    loadProducts();

    // --- Stats counter ---
    const statNumbers = document.querySelectorAll('.stat-number');
    const statsObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const el = entry.target;
                const target = parseInt(el.dataset.target);
                animateCounter(el, target);
                statsObserver.unobserve(el);
            }
        });
    }, { threshold: 0.5 });

    statNumbers.forEach(el => statsObserver.observe(el));

    function animateCounter(el, target) {
        let current = 0;
        const step = Math.ceil(target / 60);
        const timer = setInterval(() => {
            current += step;
            if (current >= target) {
                current = target;
                clearInterval(timer);
            }
            el.textContent = current;
        }, 25);
    }

    // --- Carrito ---
    const cartBtn = document.getElementById('cart-btn');
    const cartDrawer = document.getElementById('cart-drawer');
    const closeCart = document.getElementById('close-cart');
    const cartOverlay = document.getElementById('cart-overlay');
    const cartCount = document.getElementById('cart-count');
    const cartItemsEl = document.getElementById('cart-items');
    const cartTotalPrice = document.getElementById('cart-total-price');

    function openCart() {
        cartDrawer.classList.add('open');
        cartOverlay.classList.add('visible');
    }
    function closeCartDrawer() {
        cartDrawer.classList.remove('open');
        cartOverlay.classList.remove('visible');
    }

    cartBtn.addEventListener('click', openCart);
    closeCart.addEventListener('click', closeCartDrawer);
    cartOverlay.addEventListener('click', closeCartDrawer);

    window.TusEncantosCart = {
        items: JSON.parse(localStorage.getItem('tusencantosCart') || '[]'),

        save() {
            localStorage.setItem('tusencantosCart', JSON.stringify(this.items));
            this.updateUI();
        },

        add(product) {
            const existing = this.items.find(i => i.id === product.id && i.size === product.size);
            if (existing) {
                existing.qty += 1;
            } else {
                this.items.push({ ...product, qty: 1 });
            }
            this.save();
            showToast(product.name + ' agregado al carrito');
            openCart();
        },

        remove(index) {
            this.items.splice(index, 1);
            this.save();
        },

        getTotal() {
            return this.items.reduce((sum, i) => sum + (i.price * i.qty), 0);
        },

        updateUI() {
            const count = this.items.reduce((sum, i) => sum + i.qty, 0);
            cartCount.textContent = count;
            cartCount.classList.toggle('visible', count > 0);

            cartItemsEl.innerHTML = '';
            if (this.items.length === 0) {
                cartItemsEl.innerHTML = '<p style="text-align:center;color:#999;padding:40px 0;font-size:.9rem">Tu carrito está vacío</p>';
            } else {
                this.items.forEach((item, index) => {
                    const div = document.createElement('div');
                    div.className = 'cart-item';
                    div.innerHTML = `
                        <img src="${escapeAttr(item.image)}" alt="${escapeAttr(item.name)}" width="70" height="85">
                        <div class="cart-item-info">
                            <h4>${escapeHtml(item.name)}</h4>
                            <p class="cart-item-size">Talle: ${escapeHtml(item.size)} — Cant: ${item.qty}</p>
                            <p class="cart-item-price">$${(item.price * item.qty).toLocaleString('es-AR')}</p>
                        </div>
                        <button class="cart-item-remove" data-index="${index}">✕</button>
                    `;
                    cartItemsEl.appendChild(div);
                });
            }

            cartTotalPrice.textContent = '$' + this.getTotal().toLocaleString('es-AR');

            cartItemsEl.querySelectorAll('.cart-item-remove').forEach(btn => {
                btn.addEventListener('click', () => {
                    this.remove(parseInt(btn.dataset.index));
                });
            });
        }
    };

    window.TusEncantosCart.updateUI();

    function showToast(message) {
        const existing = document.querySelector('.notification-toast');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.className = 'notification-toast';
        toast.textContent = message;
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('out');
            setTimeout(() => toast.remove(), 400);
        }, 2500);
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str || '';
        return div.innerHTML;
    }

    function escapeAttr(str) {
        return (str || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
});

    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const href = this.getAttribute('href');
            if (href === '#') return;
            e.preventDefault();
            const target = document.querySelector(href);
            if (target) {
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    });

    const shapes = document.querySelectorAll('.hero-bg-shapes .shape');
    window.addEventListener('scroll', () => {
        const scrollY = window.scrollY;
        shapes.forEach((shape, i) => {
            const speed = (i + 1) * 0.15;
            shape.style.transform = `translateY(${scrollY * speed}px)`;
        });
    }, { passive: true });

