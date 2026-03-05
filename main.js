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

    const pills = document.querySelectorAll('.category-pill');
    const cards = document.querySelectorAll('.product-card');

    pills.forEach(pill => {
        pill.addEventListener('click', () => {
            pills.forEach(p => p.classList.remove('active'));
            pill.classList.add('active');

            const filter = pill.dataset.filter;

            cards.forEach(card => {
                if (filter === 'all' || card.dataset.category === filter) {
                    card.classList.remove('hidden');
                    card.style.animation = 'fadeInUp .5s var(--ease) forwards';
                } else {
                    card.classList.add('hidden');
                }
            });
        });
    });

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
                        <img src="${item.image}" alt="${item.name}" width="70" height="85">
                        <div class="cart-item-info">
                            <h4>${item.name}</h4>
                            <p class="cart-item-size">Talle: ${item.size} — Cant: ${item.qty}</p>
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

});