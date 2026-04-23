document.addEventListener('DOMContentLoaded', () => {
    const loginScreen = document.getElementById('login-screen');
    const dashboard = document.getElementById('dashboard');
    const loginForm = document.getElementById('login-form');
    const loginError = document.getElementById('login-error');
    const toastEl = document.getElementById('admin-toast');


    // ---- LOGIN ----
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const user = document.getElementById('login-user').value.trim();
        const pass = document.getElementById('login-pass').value;

        if (!user || !pass) { loginError.textContent = 'Completá todos los campos'; return; }

        if(user === 'Tusencantos' && pass === 'Tusencantos!') {
            try {
                await auth.signInAnonymously();
            } catch (err) {
                loginError.textContent = 'Error de autenticación. Habilitá Auth Anónimo en Firebase Console.';
            }
        } else {
            loginError.textContent = 'Usuario o contraseña incorrectos';
        }
    });

    auth.onAuthStateChanged(user => {
        if (user) {
            loginScreen.classList.add('hidden');
            dashboard.classList.remove('hidden');
            loadProducts();
            loadOrders();
        }
    });

    document.getElementById('btn-logout').addEventListener('click', async () => {
        await auth.signOut();
        dashboard.classList.add('hidden');
        loginScreen.classList.remove('hidden');
        loginForm.reset();
        loginError.textContent = '';
    });

    // ---- TABS ----
    document.querySelectorAll('.sidebar-link').forEach(link => {
        link.addEventListener('click', () => {
            document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
            document.getElementById('tab-' + link.dataset.tab).classList.add('active');
        });
    });

    // ---- PRODUCTOS ----
    const productsTbody = document.getElementById('products-tbody');
    const productsEmpty = document.getElementById('products-empty');
    const productModal = document.getElementById('product-modal');
    const productForm = document.getElementById('product-form');

    function initCategorySelect() {
        const sel = document.getElementById('pf-category');
        sel.innerHTML = '<option value="">Seleccionar...</option>';
        CATEGORIES.forEach(cat => {
            const opt = document.createElement('option');
            opt.value = cat;
            opt.textContent = cat;
            sel.appendChild(opt);
        });
    }

    function getSizesForCategory(category) {
        if (category === 'Jeans') return JEAN_SIZES;
        return ['XS', ...SIZES];
    }

    // Construye la grilla de stock. Si hay colores seleccionados → matriz talle×color o solo colores.
    function buildStockGrid(sizes, colors, existingStock) {
        const stockGrid = document.getElementById('pf-stock-grid');
        stockGrid.innerHTML = '';

        if (colors && colors.length > 0 && sizes && sizes.length > 0) {
            // --- Matriz: filas = talles, columnas = colores ---
            const table = document.createElement('div');
            table.className = 'stock-matrix';

            // Fila de encabezado
            const headerRow = document.createElement('div');
            headerRow.className = 'stock-matrix-row stock-matrix-header';
            const cornerCell = document.createElement('div');
            cornerCell.className = 'stock-matrix-cell stock-corner';
            headerRow.appendChild(cornerCell);
            colors.forEach(c => {
                const cell = document.createElement('div');
                cell.className = 'stock-matrix-cell stock-col-label';
                cell.textContent = c;
                headerRow.appendChild(cell);
            });
            table.appendChild(headerRow);

            // Filas de talles
            sizes.forEach(s => {
                const row = document.createElement('div');
                row.className = 'stock-matrix-row';
                const sizeCell = document.createElement('div');
                sizeCell.className = 'stock-matrix-cell stock-row-label';
                sizeCell.textContent = s;
                row.appendChild(sizeCell);
                colors.forEach(c => {
                    let val = 0;
                    if (existingStock && typeof existingStock[s] === 'object' && existingStock[s] !== null) {
                        val = existingStock[s][c] || 0;
                    }
                    const cell = document.createElement('div');
                    cell.className = 'stock-matrix-cell';
                    const input = document.createElement('input');
                    input.type = 'number';
                    input.min = '0';
                    input.value = val;
                    input.dataset.size = s;
                    input.dataset.color = c;
                    cell.appendChild(input);
                    row.appendChild(cell);
                });
                table.appendChild(row);
            });
            stockGrid.appendChild(table);
        } else if (colors && colors.length > 0) {
            // --- Solo colores (sin talles): una fila de color → número ---
            const table = document.createElement('div');
            table.className = 'stock-matrix';

            // Fila de encabezado
            const headerRow = document.createElement('div');
            headerRow.className = 'stock-matrix-row stock-matrix-header';
            colors.forEach(c => {
                const cell = document.createElement('div');
                cell.className = 'stock-matrix-cell stock-col-label';
                cell.textContent = c;
                headerRow.appendChild(cell);
            });
            table.appendChild(headerRow);

            // Fila de datos
            const dataRow = document.createElement('div');
            dataRow.className = 'stock-matrix-row';
            colors.forEach(c => {
                let val = 0;
                if (existingStock) {
                    const sv = existingStock[c];
                    if (typeof sv === 'number') val = sv;
                }
                const cell = document.createElement('div');
                cell.className = 'stock-matrix-cell';
                const input = document.createElement('input');
                input.type = 'number';
                input.min = '0';
                input.value = val;
                input.dataset.color = c;
                cell.appendChild(input);
                dataRow.appendChild(cell);
            });
            table.appendChild(dataRow);
            stockGrid.appendChild(table);
        } else {
            // --- Lista simple: talle → número ---
            sizes.forEach(s => {
                let val = 0;
                if (existingStock) {
                    const sv = existingStock[s];
                    if (typeof sv === 'number') val = sv;
                    else if (typeof sv === 'object' && sv !== null) {
                        // Si hay stock anidado pero no hay colores seleccionados, sumar total
                        val = Object.values(sv).reduce((a, b) => a + b, 0);
                    }
                }
                const div = document.createElement('div');
                div.className = 'stock-size-item';
                const input = document.createElement('input');
                input.type = 'number';
                input.min = '0';
                input.value = val;
                input.dataset.size = s;
                div.innerHTML = `<span>${s}</span>`;
                div.appendChild(input);
                stockGrid.appendChild(div);
            });
        }
    }

    function getSelectedColors() {
        const checked = [];
        document.querySelectorAll('#pf-colors input:checked').forEach(cb => checked.push(cb.value));
        return checked;
    }

    function getSelectedSizes() {
        const checked = [];
        document.querySelectorAll('#pf-sizes input:checked').forEach(cb => checked.push(cb.value));
        return checked;
    }

    function updateSizesForCategory(category) {
        const sizes = getSizesForCategory(category);

        // Actualizar checkboxes de talles
        const sizesContainer = document.getElementById('pf-sizes');
        sizesContainer.innerHTML = '';
        sizes.forEach(s => {
            const label = document.createElement('label');
            label.innerHTML = `<input type="checkbox" value="${s}"> ${s}`;
            sizesContainer.appendChild(label);
        });

        // Colores disponibles para TODAS las categorías
        const colorsField = document.getElementById('pf-colors-field');
        colorsField.style.display = '';
        const colorsContainer = document.getElementById('pf-colors');
        colorsContainer.innerHTML = '';
        COLORS.forEach(c => {
            const label = document.createElement('label');
            label.innerHTML = `<input type="checkbox" value="${c}" class="pf-color-cb"> ${c}`;
            colorsContainer.appendChild(label);
        });

        // Grilla de stock vacía al inicio (ningún talle ni color seleccionado aún)
        buildStockGrid([], [], null);
    }

    initCategorySelect();
    updateSizesForCategory('');

    // Cuando cambia la categoría, actualizar talles/stock/colores
    document.getElementById('pf-category').addEventListener('change', (e) => {
        updateSizesForCategory(e.target.value);
    });

    function rebuildStockGrid() {
        const selectedSizes = getSelectedSizes();
        const selectedColors = getSelectedColors();
        const currentStock = collectStockFromGrid();
        buildStockGrid(selectedSizes, selectedColors, currentStock);
    }

    // Cuando cambian los talles, reconstruir grilla de stock
    document.getElementById('pf-sizes').addEventListener('change', () => {
        rebuildStockGrid();
    });

    // Cuando cambian los colores, reconstruir grilla de stock
    document.getElementById('pf-colors').addEventListener('change', () => {
        rebuildStockGrid();
    });

    document.getElementById('btn-add-product').addEventListener('click', () => openProductModal());
    document.getElementById('modal-close').addEventListener('click', () => closeProductModal());
    document.getElementById('btn-cancel-product').addEventListener('click', () => closeProductModal());

    function openProductModal(product, docId) {
        document.getElementById('modal-title').textContent = product ? 'Editar Producto' : 'Nuevo Producto';
        document.getElementById('pf-id').value = docId || '';
        document.getElementById('pf-name').value = product ? product.name : '';
        document.getElementById('pf-price').value = product ? product.price : '';
        document.getElementById('pf-badge').value = product ? (product.badge || '') : '';
        document.getElementById('pf-description').value = product ? product.description : '';

        // Actualizar talles/stock/colores según categoría ANTES de asignar valores
        const category = product ? product.category : '';
        document.getElementById('pf-category').value = category;
        updateSizesForCategory(category);

        // Marcar colores del producto (para TODAS las categorías)
        const productColors = product ? (product.colors || []) : [];
        document.querySelectorAll('#pf-colors input').forEach(cb => {
            cb.checked = productColors.includes(cb.value);
        });

        // Reconstruir grilla de stock con los talles y colores del producto y el stock existente
        const productSizes = product ? (product.sizes || []) : [];
        buildStockGrid(productSizes, productColors, product ? product.stock : null);

        document.getElementById('pf-features').value = product ? (product.features || []).join('\n') : '';
        document.getElementById('pf-image-files').value = '';

        // Arrays de estado del modal
        const existingUrls = product
            ? (product.images && product.images.length > 0 ? [...product.images] : (product.image ? [product.image] : []))
            : [];
        window._adminKeptUrls = [...existingUrls];
        window._adminPendingFiles = [];

        // Preview de imágenes existentes con botón eliminar
        const previewContainer = document.getElementById('pf-images-preview');
        previewContainer.innerHTML = '';
        existingUrls.forEach(url => {
            addExistingImageThumb(previewContainer, url);
        });

        // Talles disponibles
        document.querySelectorAll('#pf-sizes input').forEach(cb => {
            cb.checked = product ? (product.sizes || []).includes(cb.value) : false;
        });

        productModal.classList.remove('hidden');
    }

    function closeProductModal() {
        productModal.classList.add('hidden');
        productForm.reset();
        updateSizesForCategory('');
    }

    // Lee los valores de la grilla de stock (simple, matriz o solo colores)
    function collectStockFromGrid() {
        const stockData = {};
        const colorInputs = document.querySelectorAll('#pf-stock-grid [data-color]');
        if (colorInputs.length > 0) {
            const firstHasSize = colorInputs[0].dataset.size && colorInputs[0].dataset.size !== '';
            if (firstHasSize) {
                // Matriz talle×color
                colorInputs.forEach(input => {
                    const size = input.dataset.size;
                    const color = input.dataset.color;
                    if (!stockData[size]) stockData[size] = {};
                    stockData[size][color] = parseInt(input.value) || 0;
                });
            } else {
                // Solo colores (sin talles)
                colorInputs.forEach(input => {
                    stockData[input.dataset.color] = parseInt(input.value) || 0;
                });
            }
        } else {
            // Simple: solo por talle
            document.querySelectorAll('#pf-stock-grid [data-size]').forEach(input => {
                stockData[input.dataset.size] = parseInt(input.value) || 0;
            });
        }
        return stockData;
    }

    function addExistingImageThumb(container, url) {
        const wrap = document.createElement('div');
        wrap.className = 'img-thumb-wrap';
        wrap.dataset.url = url;
        const img = document.createElement('img');
        img.src = url.startsWith('http') ? url : '../' + url;
        img.alt = 'Preview';
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'img-thumb-remove';
        btn.title = 'Eliminar foto';
        btn.textContent = '✕';
        btn.addEventListener('click', () => {
            window._adminKeptUrls = window._adminKeptUrls.filter(u => u !== url);
            wrap.remove();
        });
        wrap.appendChild(img);
        wrap.appendChild(btn);
        container.appendChild(wrap);
    }

    function addNewImageThumb(container, file) {
        const wrap = document.createElement('div');
        wrap.className = 'img-thumb-wrap';
        const reader = new FileReader();
        reader.onload = (ev) => {
            const img = document.createElement('img');
            img.src = ev.target.result;
            img.alt = 'Preview';
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'img-thumb-remove';
            btn.title = 'Eliminar foto';
            btn.textContent = '✕';
            btn.addEventListener('click', () => {
                window._adminPendingFiles = window._adminPendingFiles.filter(f => f !== file);
                wrap.remove();
            });
            wrap.appendChild(img);
            wrap.appendChild(btn);
            container.appendChild(wrap);
        };
        reader.readAsDataURL(file);
        window._adminPendingFiles.push(file);
    }

    // Image files preview (append, don't replace)
    document.getElementById('pf-image-files').addEventListener('change', (e) => {
        const previewContainer = document.getElementById('pf-images-preview');
        Array.from(e.target.files).forEach(file => addNewImageThumb(previewContainer, file));
        // Reset input so the same file can be re-selected if needed
        e.target.value = '';
    });

    // Save product
    productForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const docId = document.getElementById('pf-id').value;
        const name = document.getElementById('pf-name').value.trim();
        const price = parseInt(document.getElementById('pf-price').value);
        const category = document.getElementById('pf-category').value;
        const description = document.getElementById('pf-description').value.trim();

        if (!name || !price || !category || !description) {
            showToast('Completá los campos obligatorios', 'error');
            return;
        }

        const sizes = [];
        document.querySelectorAll('#pf-sizes input:checked').forEach(cb => sizes.push(cb.value));

        const features = document.getElementById('pf-features').value
            .split('\n').map(f => f.trim()).filter(f => f);

        // URLs existentes conservadas + nuevos archivos a subir
        let imageUrls = [...(window._adminKeptUrls || [])];
        const filesToUpload = window._adminPendingFiles || [];

        if (filesToUpload.length > 0) {
            try {
                showToast('Subiendo imágenes...', 'info');
                for (const file of filesToUpload) {
                    const formData = new FormData();
                    formData.append('image', file);
                    formData.append('secret', 'TusEncantosUpload2026!');
                    const resp = await fetch('../api/upload.php', { method: 'POST', body: formData });
                    const result = await resp.json();
                    if (!resp.ok) throw new Error(result.error || 'Error al subir imagen');
                    imageUrls.push(result.url);
                }
            } catch (err) {
                showToast('Error subiendo imagen: ' + err.message, 'error');
                return;
            }
        }

        const stockBySizeData = collectStockFromGrid();

        // Colores (todas las categorías)
        const colors = [];
        document.querySelectorAll('#pf-colors input:checked').forEach(cb => colors.push(cb.value));

        const data = {
            name, price, category, description,
            badge: document.getElementById('pf-badge').value.trim(),
            stock: stockBySizeData,
            image: imageUrls[0] || '',
            images: imageUrls,
            sizes, features, colors,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        try {
            if (docId) {
                await db.collection('products').doc(docId).update(data);
                showToast('Producto actualizado', 'success');
            } else {
                data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
                await db.collection('products').add(data);
                showToast('Producto creado', 'success');
            }
            closeProductModal();
            loadProducts();
        } catch (err) {
            showToast('Error: ' + err.message, 'error');
        }
    });

    async function loadProducts() {
        try {
            const snapshot = await db.collection('products').orderBy('createdAt', 'desc').get();
            productsTbody.innerHTML = '';

            if (snapshot.empty) {
                productsEmpty.classList.remove('hidden');
                return;
            }
            productsEmpty.classList.add('hidden');

            snapshot.forEach(doc => {
                const p = doc.data();
                const imgSrc = p.image ? (p.image.startsWith('http') ? p.image : '../' + p.image) : '';
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><img src="${escapeAttr(imgSrc)}" alt="${escapeAttr(p.name)}"></td>
                    <td><strong>${escapeHtml(p.name)}</strong></td>
                    <td>${escapeHtml(p.category)}</td>
                    <td>$${p.price ? p.price.toLocaleString('es-AR') : '0'}</td>
                    <td>${(() => {
                        if (!p.stock && p.stock !== 0) return 0;
                        if (typeof p.stock === 'object') {
                            let total = 0;
                            const lowItems = [];
                            Object.entries(p.stock).forEach(([sizeKey, sizeVal]) => {
                                if (typeof sizeVal === 'object' && sizeVal !== null) {
                                    // Stock anidado: talle → { color: n }
                                    Object.entries(sizeVal).forEach(([colorKey, n]) => {
                                        total += n;
                                        if (n < 3 && n >= 0) lowItems.push(sizeKey + '/' + colorKey);
                                    });
                                } else {
                                    total += sizeVal;
                                    if (sizeVal < 3 && sizeVal >= 0) lowItems.push(sizeKey);
                                }
                            });
                            const badge = lowItems.length ? '<span class="low-stock-badge">⚠ ' + lowItems.slice(0, 4).join(', ') + (lowItems.length > 4 ? '...' : '') + '</span> ' : '';
                            return badge + 'Total: ' + total;
                        }
                        return p.stock < 5 ? '<span class="low-stock-badge">⚠ ' + p.stock + '</span>' : p.stock;
                    })()}</td>
                    <td>${(p.sizes || []).join(', ')}${p.colors && p.colors.length ? '<br><small style="color:#888">Colores: ' + escapeHtml(p.colors.join(', ')) + '</small>' : ''}</td>
                    <td>
                        <div class="action-btns">
                            <button class="btn-edit" data-id="${doc.id}">Editar</button>
                            <button class="btn-delete" data-id="${doc.id}" data-name="${escapeAttr(p.name)}">Eliminar</button>
                        </div>
                    </td>
                `;
                productsTbody.appendChild(tr);
            });

            productsTbody.querySelectorAll('.btn-edit').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const doc = await db.collection('products').doc(btn.dataset.id).get();
                    if (doc.exists) openProductModal(doc.data(), doc.id);
                });
            });

            productsTbody.querySelectorAll('.btn-delete').forEach(btn => {
                btn.addEventListener('click', async () => {
                    if (!confirm('¿Eliminar "' + btn.dataset.name + '"?')) return;
                    try {
                        await db.collection('products').doc(btn.dataset.id).delete();
                        showToast('Producto eliminado', 'success');
                        loadProducts();
                    } catch (err) {
                        showToast('Error: ' + err.message, 'error');
                    }
                });
            });
        } catch (err) {
            showToast('Error cargando productos: ' + err.message, 'error');
        }
    }

    // ---- PEDIDOS ----
    const ordersTbody = document.getElementById('orders-tbody');
    const ordersEmpty = document.getElementById('orders-empty');
    const orderModal = document.getElementById('order-modal');
    const orderDetail = document.getElementById('order-detail');

    document.getElementById('order-modal-close').addEventListener('click', () => orderModal.classList.add('hidden'));

    async function loadOrders() {
        try {
            const snapshot = await db.collection('orders').orderBy('createdAt', 'desc').get();
            ordersTbody.innerHTML = '';

            if (snapshot.empty) {
                ordersEmpty.classList.remove('hidden');
                return;
            }
            ordersEmpty.classList.add('hidden');

            snapshot.forEach(doc => {
                const o = doc.data();
                const date = o.createdAt ? o.createdAt.toDate().toLocaleDateString('es-AR') : '-';
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><code style="font-size:.72rem">${doc.id.slice(0, 8)}...</code></td>
                    <td>${escapeHtml((o.shipping?.name || '') + ' ' + (o.shipping?.lastname || ''))}</td>
                    <td>${escapeHtml(o.shipping?.email || '')}</td>
                    <td>$${o.total ? o.total.toLocaleString('es-AR') : '0'}</td>
                    <td><span class="status-badge ${o.status || 'pending'}">${statusLabel(o.status)}</span></td>
                    <td>${date}</td>
                    <td>
                        <div class="action-btns">
                            <button class="btn-view" data-id="${doc.id}">Ver</button>
                        </div>
                    </td>
                `;
                ordersTbody.appendChild(tr);
            });

            ordersTbody.querySelectorAll('.btn-view').forEach(btn => {
                btn.addEventListener('click', () => showOrderDetail(btn.dataset.id));
            });
        } catch (err) {
            showToast('Error cargando pedidos: ' + err.message, 'error');
        }
    }

    function statusLabel(s) {
        const map = { pending: 'Pendiente', paid: 'Pagado', cancelled: 'Cancelado', shipped: 'Enviado' };
        return map[s] || s || 'Pendiente';
    }

    async function showOrderDetail(orderId) {
        try {
            const doc = await db.collection('orders').doc(orderId).get();
            if (!doc.exists) return;
            const o = doc.data();
            const date = o.createdAt ? o.createdAt.toDate().toLocaleString('es-AR') : '-';

            let itemsHtml = '';
            (o.items || []).forEach(item => {
                const imgSrc = item.image ? (item.image.startsWith('http') ? item.image : '../' + item.image) : '';
                itemsHtml += `
                    <div class="order-item-row">
                        <img src="${escapeAttr(imgSrc)}" alt="${escapeAttr(item.name)}">
                        <div class="item-info">${escapeHtml(item.name)} — Talle: ${escapeHtml(item.size)} x${item.qty}</div>
                        <div class="item-price">$${(item.price * item.qty).toLocaleString('es-AR')}</div>
                    </div>
                `;
            });

            let billingHtml = '';
            if (o.billing) {
                billingHtml = `
                    <div class="order-detail-section">
                        <h4>Facturación</h4>
                        <p><strong>Nombre:</strong> ${escapeHtml(o.billing.name + ' ' + o.billing.lastname)}</p>
                        <p><strong>Email:</strong> ${escapeHtml(o.billing.email)}</p>
                        <p><strong>Teléfono:</strong> ${escapeHtml(o.billing.phone)}</p>
                        <p><strong>Dirección:</strong> ${escapeHtml(o.billing.address)}</p>
                    </div>
                `;
            }

            orderDetail.innerHTML = `
                <div class="order-detail-section">
                    <h4>Información General</h4>
                    <p><strong>ID:</strong> ${doc.id}</p>
                    <p><strong>Fecha:</strong> ${date}</p>
                    <p><strong>Total:</strong> $${o.total ? o.total.toLocaleString('es-AR') : '0'}</p>
                    <p><strong>Estado:</strong>
                        <select class="order-status-select" data-id="${doc.id}">
                            <option value="pending" ${o.status === 'pending' ? 'selected' : ''}>Pendiente</option>
                            <option value="paid" ${o.status === 'paid' ? 'selected' : ''}>Pagado</option>
                            <option value="shipped" ${o.status === 'shipped' ? 'selected' : ''}>Enviado</option>
                            <option value="cancelled" ${o.status === 'cancelled' ? 'selected' : ''}>Cancelado</option>
                        </select>
                    </p>
                </div>
                <div class="order-detail-section">
                    <h4>Envío</h4>
                    <p><strong>Nombre:</strong> ${escapeHtml((o.shipping?.name || '') + ' ' + (o.shipping?.lastname || ''))}</p>
                    <p><strong>Email:</strong> ${escapeHtml(o.shipping?.email || '')}</p>
                    <p><strong>Teléfono:</strong> ${escapeHtml(o.shipping?.phone || '')}</p>
                    <p><strong>Dirección:</strong> ${escapeHtml(o.shipping?.address || '')}</p>
                    ${o.shipping?.message ? `<p><strong>Mensaje:</strong> ${escapeHtml(o.shipping.message)}</p>` : ''}
                </div>
                ${billingHtml}
                <div class="order-detail-section">
                    <h4>Productos</h4>
                    <div class="order-items-list">${itemsHtml}</div>
                </div>
            `;

            orderDetail.querySelector('.order-status-select').addEventListener('change', async (e) => {
                try {
                    await db.collection('orders').doc(e.target.dataset.id).update({ status: e.target.value });
                    showToast('Estado actualizado', 'success');
                    loadOrders();
                } catch (err) {
                    showToast('Error: ' + err.message, 'error');
                }
            });

            orderModal.classList.remove('hidden');
        } catch (err) {
            showToast('Error: ' + err.message, 'error');
        }
    }

    // ---- UTILIDADES ----
    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str || '';
        return div.innerHTML;
    }

    function escapeAttr(str) {
        return (str || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    let toastTimer;
    function showToast(msg, type) {
        clearTimeout(toastTimer);
        toastEl.textContent = msg;
        toastEl.className = 'admin-toast visible ' + (type || 'info');
        toastTimer = setTimeout(() => { toastEl.className = 'admin-toast'; }, 3500);
    }
});
