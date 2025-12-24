const API_BASE = "https://posapi2025new-augrc0eshqgfgrcf.canadacentral-01.azurewebsites.net/api";

const EP_SALE = `${API_BASE}/Sale`;
const EP_WAREHOUSE = `${API_BASE}/Warehouse/select`; 
const EP_VOUCHER = `${API_BASE}/VoucherType/select`; 
const EP_CURRENCY = `${API_BASE}/Currency/select`;   
const EP_PERSON = `${API_BASE}/Person`; 
const EP_PRODUCT_SEARCH = `${API_BASE}/Product/search`; 
const EP_PRODUCT_CRUD = `${API_BASE}/Product`; 
const EP_UNIT = `${API_BASE}/UnitOfMeasure`;
const EP_IGV = `${API_BASE}/IGVType`;
const EP_CATEGORY = `${API_BASE}/Category`;
const EP_DOC_TYPES = `${API_BASE}/DocumentType/select`;

// NUEVA CONSTANTE PARA LA SERIE/NUMERO
const EP_VOUCHER_SERIE = `${API_BASE}/VoucherSerie/next-number`;

let currentPage = 1;
let pageSize = 10;
let totalPages = 1;
let searchTerm = "";
let warehouseId = "";

// VARIABLES NUEVAS PARA FECHAS
let startDate = "";
let endDate = "";

let igvListCache = []; 
let searchResults = {}; 
let searchTimer = null; 

// ==========================================
// VARIABLES GESTIÓN DE PESTAÑAS
// ==========================================
let salesTabs = [];       // Array para guardar el estado de cada venta
let activeTabId = null;   // ID de la pestaña actual
let tabCounter = 1;       // Contador para generar IDs únicos

toastr.options = { "closeButton": true, "positionClass": "toast-bottom-right", "timeOut": "5000", "preventDuplicates": false };

$(document).ready(function() {
    loadWarehouses();
    prepararOpcionesIGV();

    // APLICAR CAMBIO SOLICITADO: MÁXIMO 25 DÍGITOS EN MODAL CREAR CLIENTE (VENTAS)
    $('#ncli_numeroDoc').attr('maxlength', '25');

    $('#btnPrev').click(() => cambiarPagina(-1));
    $('#btnNext').click(() => cambiarPagina(1));
    $('#btnFirst').click(() => irAPagina(1));
    $('#btnLast').click(() => irAPagina(totalPages));
    $('#pageSizeSelect').on('change', function() { pageSize = parseInt($(this).val()); currentPage = 1; fetchVentas(currentPage); });
    
    $('#searchInput').on('input', function() {
        const val = $(this).val().trim();
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => { searchTerm = val; currentPage = 1; fetchVentas(currentPage); }, 300); 
    });

    $('#warehouseSelect').on('change', function() { warehouseId = $(this).val(); currentPage = 1; fetchVentas(currentPage); });

    // ==========================================
    // LOGICA DE FILTROS DE FECHA (CON X)
    // ==========================================
    $('#startDate').on('change', function() {
        startDate = $(this).val();
        if(startDate) $('#clearStartDate').show();
        else $('#clearStartDate').hide();
        currentPage = 1;
        fetchVentas(currentPage);
    });

    $('#endDate').on('change', function() {
        endDate = $(this).val();
        if(endDate) $('#clearEndDate').show();
        else $('#clearEndDate').hide();
        currentPage = 1;
        fetchVentas(currentPage);
    });

    $('#clearStartDate').click(function() {
        $('#startDate').val('');
        startDate = "";
        $(this).hide();
        currentPage = 1;
        fetchVentas(currentPage);
    });

    $('#clearEndDate').click(function() {
        $('#endDate').val('');
        endDate = "";
        $(this).hide();
        currentPage = 1;
        fetchVentas(currentPage);
    });

    // Eventos Modal Nueva Venta
    $('#nv_buscarCliente').on('input focus', function() { buscarPersona($(this).val()); });
    $('#nv_buscarProducto').on('input focus', function() { buscarProducto($(this).val()); });
    
    $('#btnLimpiarCliente').click(function() {
        $('#nv_buscarCliente').val('').focus();
        $('#nv_idCliente').val('');
        $(this).hide();
    });

    $('.form-control').on('input change', function() { $(this).removeClass('error'); $(this).siblings('.error-message').removeClass('show'); });
    $(document).on('input', '.input-table', function() { 
        const val = parseFloat($(this).val());
        if(!isNaN(val) && val > 0) { 
            $(this).removeClass('error'); 
            $(this).closest('.input-container').find('.row-error-msg').hide(); 
        }
    });

    $(document).click(function(e) { if (!$(e.target).closest('.autocomplete-wrapper').length) { $('.autocomplete-list').hide(); } });

    // =========================================================================
    // LÓGICA CORREGIDA PARA INPUT DE N° DOCUMENTO (CLIENTE)
    // =========================================================================
    $('#ncli_numeroDoc').on('input', function(e) {
        // Obtenemos el tipo seleccionado (usando el atributo data-name que seteamos al cargar)
        const selectedOption = $('#ncli_tipoDoc option:selected');
        const tipoName = (selectedOption.data('name') || selectedOption.text()).toUpperCase();

        // Solo forzamos "Solo Números" si es DNI o RUC
        // Si es "Documento Tributario", permitimos todo (limitado por maxlength=25)
        if (tipoName.includes('DNI') || tipoName.includes('RUC')) {
            e.target.value = e.target.value.replace(/\D/g, ''); 
        }
        
        validarReglasDocumento();
    });
    
    $('#ncli_tipoDoc').on('change', function() {
        $('#ncli_numeroDoc').val('').focus();
        $('#ncli_numeroDoc').removeClass('error');
        $('#error_ncli_numeroDoc').removeClass('show');
    });

    // =======================================================
    // NUEVO EVENTO: CAMBIO DE TIPO DE DOCUMENTO (FACTURA/BOLETA)
    // =======================================================
    $('#nv_tipoDoc').on('change', function() {
        obtenerSiguienteNumero();
    });

    // ==========================================
    // NUEVO EVENTO: BOTÓN DUPLICAR VENTA
    // ==========================================
    $('#btnDuplicateSale').click(function() {
        // 1. Guardar estado actual antes de duplicar
        if (activeTabId) saveCurrentTabData();
        
        // 2. Crear nueva pestaña copiando la actual
        createTab(true); 
    });
});

function formatoMoneda(v) { if (v == null || isNaN(v)) return "0.00"; return parseFloat(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function formatearFechaPeru(f, h) { if (!f) return '-'; const d = new Date(f); const o = { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'America/Lima' }; if (h) { o.hour = '2-digit'; o.minute = '2-digit'; o.second = '2-digit'; o.hour12 = false; } return d.toLocaleString('es-PE', o); }

async function loadWarehouses() {
    try {
        const r = await fetch(EP_WAREHOUSE); const d = await r.json(); const s = $('#warehouseSelect'); s.empty(); 
        if (d.length > 0) { d.forEach((w, i) => { s.append(`<option value="${w.id}">${w.name}</option>`); if (i === 0) warehouseId = w.id; }); fetchVentas(currentPage); }
    } catch (e) { console.error(e); }
}

async function prepararOpcionesIGV() {
    try { const r = await fetch(EP_IGV); const d = await r.json(); igvListCache = d; } catch (e) { console.error(e); }
}

async function fetchVentas(page) {
    const $tbody = $('#ventasBody'); $tbody.html('<tr><td colspan="8" class="text-center" style="padding: 20px;">Cargando...</td></tr>');
    try {
        const url = `${EP_SALE}?pageNumber=${page}&pageSize=${pageSize}&searchTerm=${searchTerm}&warehouseId=${warehouseId}&startDate=${startDate}&endDate=${endDate}`;
        const r = await fetch(url); 
        const d = await r.json();
        
        $tbody.empty(); const l = d.items || [];
        if (l.length === 0) { $tbody.html('<tr><td colspan="8" class="text-center" style="padding: 20px;">No se encontraron resultados.</td></tr>'); return; }
        
        l.forEach(v => {
            const f = formatearFechaPeru(v.issueDate, false);
            const sn = v.voucherNumber || '-';
            const dn = v.personDocumentNumber || '';
            const dl = v.personDocumentType || (dn.length === 11 ? "RUC" : "DNI");
            const tot = formatoMoneda(v.total);
            
            $tbody.append(`<tr><td>${f}</td><td style="color:#6b7280">${v.warehouse||'-'}</td><td><span style="background:#1f2937;color:white;padding:4px 10px;border-radius:6px;font-size:12px;font-weight:600">${v.voucherType||'Doc'}</span></td><td><span style="background:#eff6ff;color:#3b82f6;padding:4px 10px;border-radius:6px;font-size:13px;font-weight:600;border:1px solid #dbeafe">${sn}</span></td><td><div style="font-weight:600;color:#111827">${v.personName||'Cliente'}</div><div style="font-size:11px;color:#6b7280;margin-top:2px"><strong>${dl}:</strong> ${dn}</div></td><td style="color:#4b5563">${v.currency||'-'}</td><td style="font-weight:700;color:#111827">${tot}</td><td class="text-center"><button class="btn-action" onclick="abrirModalDetalle('${v.id}')"><i class='bx bx-show'></i></button></td></tr>`);
        });

        currentPage = d.pageNumber; totalPages = d.totalPages;
        $('#lblStart').text((currentPage - 1) * pageSize + 1); $('#lblEnd').text(Math.min(currentPage * pageSize, d.totalCount)); $('#lblTotal').text(d.totalCount); $('#btnPageDisplay').text(`${currentPage} / ${totalPages}`);
        $('#btnPrev').prop('disabled', !d.hasPreviousPage); $('#btnFirst').prop('disabled', !d.hasPreviousPage); $('#btnNext').prop('disabled', !d.hasNextPage); $('#btnLast').prop('disabled', !d.hasNextPage);
    } catch (e) { console.error(e); }
}
function cambiarPagina(d) { const p = currentPage + d; if (p >= 1 && p <= totalPages) fetchVentas(p); }
function irAPagina(p) { if (p >= 1 && p <= totalPages) fetchVentas(p); }

// ==========================================
// FUNCIÓN: LIMPIAR FORMULARIO VENTA
// ==========================================
function limpiarFormularioVenta() {
    // 1. Limpiar Inputs
    $('#nv_buscarCliente').val('');
    $('#nv_idCliente').val('');
    $('#nv_buscarProducto').val('');
    
    // Limpiar el nuevo campo de serie
    $('#nv_serieNumero').val('');

    // 2. Ocultar elementos UI
    $('#btnLimpiarCliente').hide();
    $('#listaClientes').hide();
    $('#listaProductos').hide();

    // 3. Vaciar Tabla
    $('#nv_tablaProductos').empty();

    // 4. Resetear Totales Visuales
    $('#nv_txtNoGravado').text('0.00');
    $('#nv_txtSubTotal').text('0.00');
    $('#nv_txtIGV').text('0.00');
    $('#nv_txtTotal').text('0.00');

    // 5. Limpiar Errores
    $('.form-control').removeClass('error');
    $('.error-message').removeClass('show');
}

// ==========================================
// LÓGICA DE PESTAÑAS (TAB MANAGER)
// ==========================================

function initTabs() {
    salesTabs = [];
    tabCounter = 1;
    activeTabId = null;
    $('#salesTabsBar').empty();
    
    // Crear la primera pestaña por defecto
    createTab(false);
}

function createTab(copyFromCurrent = false) {
    // ==============================================
    // VALIDACIÓN: MÁXIMO 5 PESTAÑAS
    // ==============================================
    if (salesTabs.length >= 5) {
        toastr.warning("Máximo 5 pestañas permitidas.");
        return;
    }

    const newId = tabCounter++;
    
    let newData = {
        id: newId,
        warehouseId: $('#nv_almacen').val() || '',
        docTypeId: $('#nv_tipoDoc').val() || '',
        currencyId: $('#nv_moneda').val() || '',
        clientId: '',
        clientName: '',
        products: [] 
    };

    // Si es duplicado, copiar datos del actual
    if (copyFromCurrent && activeTabId) {
        saveCurrentTabData();
        const currentData = salesTabs.find(t => t.id === activeTabId);
        if (currentData) {
            newData.warehouseId = currentData.warehouseId;
            newData.docTypeId = currentData.docTypeId;
            newData.currencyId = currentData.currencyId;
            newData.clientId = currentData.clientId;
            newData.clientName = currentData.clientName;
            newData.products = JSON.parse(JSON.stringify(currentData.products));
        }
    } else if (!copyFromCurrent) {
         if($('#nv_almacen').val()) newData.warehouseId = $('#nv_almacen').val();
         if($('#nv_tipoDoc').val()) newData.docTypeId = $('#nv_tipoDoc').val();
         if($('#nv_moneda').val()) newData.currencyId = $('#nv_moneda').val();
    }

    salesTabs.push(newData);
    renderTabs();
    switchTab(newId);
}

function renderTabs() {
    const $container = $('#salesTabsBar');
    $container.empty();
    
    salesTabs.forEach(tab => {
        const activeClass = (tab.id === activeTabId) ? 'active' : '';
        const closeBtn = salesTabs.length > 1 ? `<span class="tab-close" onclick="event.stopPropagation(); closeTab(${tab.id})">×</span>` : '';
        
        $container.append(`
            <div class="tab-item ${activeClass}" onclick="switchTab(${tab.id})">
                Venta ${tab.id}
                ${closeBtn}
            </div>
        `);
    });

    // ==========================================================
    // NUEVO BOTÓN AGREGAR PESTAÑA (+)
    // ==========================================================
    if (salesTabs.length < 5) {
        $container.append(`
            <div class="tab-add-btn" onclick="createTab(false)" title="Nueva Pestaña Vacía">
                <i class='bx bx-plus'></i>
            </div>
        `);
    }
}

function switchTab(tabId) {
    // 1. Guardar estado de la pestaña actual antes de cambiar
    if (activeTabId && salesTabs.find(t => t.id === activeTabId)) {
        saveCurrentTabData();
    }
    
    // 2. Cambiar ID activo
    activeTabId = tabId;
    renderTabs();
    
    // 3. Cargar datos de la nueva pestaña en el formulario
    loadTabData(tabId);
}

function closeTab(tabId) {
    // Eliminar del array
    salesTabs = salesTabs.filter(t => t.id !== tabId);
    
    // Si cerramos la activa, cambiar a la última disponible
    if (tabId === activeTabId) {
        if (salesTabs.length > 0) {
            switchTab(salesTabs[salesTabs.length - 1].id);
        } else {
            // Si no quedan pestañas, cerrar modal
            cerrarModal('modalNuevaVenta');
        }
    } else {
        renderTabs();
    }
}

function saveCurrentTabData() {
    const currentTab = salesTabs.find(t => t.id === activeTabId);
    if (!currentTab) return;
    
    // Guardar Selects
    currentTab.warehouseId = $('#nv_almacen').val();
    currentTab.docTypeId = $('#nv_tipoDoc').val();
    currentTab.currencyId = $('#nv_moneda').val();
    
    // Guardar Cliente
    currentTab.clientId = $('#nv_idCliente').val();
    currentTab.clientName = $('#nv_buscarCliente').val();
    
    // Guardar Productos
    currentTab.products = [];
    $('#nv_tablaProductos tr').each(function() {
        const row = $(this);
        const prodId = row.data('id');
        const code = row.find('td:eq(0) div').text();
        const name = row.find('td:eq(0) small').text();
        const unit = row.find('td:eq(1)').text();
        const stock = row.find('td:eq(2)').text(); 
        const qty = row.find('.qty').val();
        const val = row.find('.val').val();
        
        currentTab.products.push({
            id: prodId,
            code: code,
            name: name,
            unitOfMeasure: unit,
            stock: stock,
            quantity: qty,
            unitValue: val
        });
    });
}

function loadTabData(tabId) {
    const tabData = salesTabs.find(t => t.id === tabId);
    if (!tabData) return;

    // ==============================================================
    // FIX: RESTAURAR BOTÓN GUARDAR (QUITAR ESTADO "GUARDANDO...")
    // ==============================================================
    const $btn = $('#modalNuevaVenta .btn-save-modal');
    $btn.prop('disabled', false).html("<i class='bx bx-save'></i> Guardar Venta");
    
    // Restaurar Selects
    $('#nv_almacen').val(tabData.warehouseId);
    $('#nv_tipoDoc').val(tabData.docTypeId);
    $('#nv_moneda').val(tabData.currencyId);
    
    // Restaurar Cliente
    if (tabData.clientId) {
        $('#nv_idCliente').val(tabData.clientId);
        $('#nv_buscarCliente').val(tabData.clientName);
        $('#btnLimpiarCliente').show();
        $('#listaClientes').hide();
    } else {
        $('#nv_idCliente').val('');
        $('#nv_buscarCliente').val('');
        $('#btnLimpiarCliente').hide();
    }
    
    // Disparar lógica de número de documento
    obtenerSiguienteNumero(); 

    // Restaurar Tabla Productos
    $('#nv_tablaProductos').empty();
    tabData.products.forEach(p => {
        const mockProd = {
            id: p.id,
            code: p.code,
            name: p.name,
            unitOfMeasure: p.unitOfMeasure,
            stock: p.stock
        };
        restaurarProductoEnTabla(mockProd, p.quantity, p.unitValue);
    });
    
    calcularTotalesGlobales();
}

function restaurarProductoEnTabla(prod, qtyVal, priceVal) {
    const rowId = Date.now() + Math.random().toString(16).slice(2);
    
    const row = `<tr id="row_${rowId}" data-id="${prod.id}">
        <td><div style="font-weight:700;color:#333;">${prod.code||''}</div><small style="color:#666;font-size:12px;">${prod.name}</small></td>
        <td>${prod.unitOfMeasure||'UNI'}</td>
        <td class="text-center" style="color: #000; font-weight:700;">${prod.stock}</td>
        
        <td><div class="input-container"><input type="number" class="input-table qty" value="${qtyVal}" min="0.01" step="any" oninput="calcularFila('${rowId}')"><span class="row-error-msg">Requerido</span></div></td>
        <td><div class="input-container"><div style="display:flex;align-items:center;width:100%;"><input type="number" class="input-table val" value="${priceVal}" min="0.01" step="any" oninput="calcularFila('${rowId}')"></div><span class="row-error-msg">Requerido</span></div></td>
        
        <td class="text-right subtotal">0.00</td><td class="text-right igv">0.00</td><td class="text-right total" style="font-weight:bold;">0.00</td>
        <td class="text-center"><button class="btn-delete-row" onclick="eliminarFila('${rowId}')"><i class='bx bx-trash'></i></button></td></tr>`;
        
    $('#nv_tablaProductos').append(row); 
    calcularFila(rowId);
}

// ==========================================
// FIN LÓGICA DE PESTAÑAS
// ==========================================

async function abrirModalNuevaVenta() {
    $('#modalNuevaVenta').css('display', 'flex');

    // Inicializar sistema de pestañas
    initTabs(); 

    const $btn = $('#modalNuevaVenta .btn-save-modal');
    $btn.prop('disabled', false).html("<i class='bx bx-save'></i> Guardar Venta");
    
    await cargarDropdown(EP_WAREHOUSE, 'nv_almacen'); 
    await cargarDropdown(EP_VOUCHER, 'nv_tipoDoc'); 
    await cargarDropdown(EP_CURRENCY, 'nv_moneda');
    
    saveCurrentTabData();

    // ==========================================
    // LOGICA PARA DESHABILITAR "NO DOMICILIADO"
    // ==========================================
    $('#nv_tipoDoc option').each(function() {
        if($(this).text().toLowerCase().includes('no domiciliado')) {
            $(this).prop('disabled', true); 
        }
    });

    if($('#nv_tipoDoc option:selected').prop('disabled')){
         $('#nv_tipoDoc').val($('#nv_tipoDoc option:not(:disabled):first').val());
         saveCurrentTabData();
    }

    if($('#nv_tipoDoc').val()) {
        obtenerSiguienteNumero();
    }
}

async function cargarDropdown(u,e){ 
    try{
        const r=await fetch(u);
        const d=await r.json();
        const s=$(`#${e}`);
        s.empty();
        d.forEach(i=>{
            s.append(`<option value="${i.id}">${i.description||i.name||i.text||i.symbol||"Sin Nombre"}</option>`);
        });
    }catch(x){console.error(x);} 
}

// =========================================================
//  NUEVA FUNCIÓN: OBTENER SIGUIENTE NÚMERO DE COMPROBANTE
// =========================================================
async function obtenerSiguienteNumero() {
    const tipoDocId = $('#nv_tipoDoc').val();
    const $inputSerie = $('#nv_serieNumero');
    
    $inputSerie.val('Cargando...');
    
    if(!tipoDocId) {
        $inputSerie.val('');
        return;
    }

    try {
        const url = `${EP_VOUCHER_SERIE}?voucherTypeId=${tipoDocId}`;
        const response = await fetch(url);
        
        if(response.ok) {
            const data = await response.json();
            $inputSerie.val(data.fullNumber || `${data.serie}-${data.nextNumber}`);
        } else {
            console.error('Error al obtener serie');
            $inputSerie.val('Error al cargar');
        }
    } catch(e) {
        console.error(e);
        $inputSerie.val('Error de conexión');
    }
}


// =========================================================
//  LÓGICA: BUSCADOR DE CLIENTES
// =========================================================
async function buscarPersona(t){ 
    const l=$('#listaClientes');const q=t?t.trim():""; 
    if(q.length<1){l.hide();return;} 
    try{
        const r=await fetch(`${API_BASE}/Person/search?searchTerm=${q}`);
        const d=await r.json();
        const i=d.items||d; 
        l.empty(); 
        if(i.length>0){
            l.show();
            i.forEach(p=>{
                const dn=p.documentNumber||'';
                let dl=p.documentType||(dn.length===11?"RUC":"DNI"); 
                
                const itemHtml = `
                <div class="autocomplete-item">
                    <div class="item-info-clickable" style="width:100%" onclick="seleccionarCliente('${p.id}', '${dl}: ${dn} - ${p.name}')">
                        <div style="font-weight: 600; color: #333; font-size: 13px;">${p.name}</div>
                        <div style="color: #666; font-size: 11px; margin-top: 2px;">${dl}: ${dn}</div>
                    </div>
                </div>`;
                l.append(itemHtml);
            });
        }else{ l.hide(); }
    }catch(e){l.hide();} 
}

function seleccionarCliente(id, txt){ 
    $('#nv_buscarCliente').val(txt); 
    $('#nv_idCliente').val(id); 
    $('#btnLimpiarCliente').show(); 
    $('#listaClientes').hide(); 
    $('#nv_buscarCliente').removeClass('error'); 
    $('#error_nv_cliente').removeClass('show'); 
    
    saveCurrentTabData();
}

// --------------------------------------------------------------------------------------
// LOGICA DE BUSQUEDA DE PRODUCTOS
// --------------------------------------------------------------------------------------
async function buscarProducto(t){ 
    const l=$('#listaProductos'); const a=$('#nv_almacen').val();
    if(!a){ l.hide(); return; } const q=t?t.trim():""; if(q.length<1){ l.hide(); return; } 
    try {
        const r=await fetch(`${EP_PRODUCT_SEARCH}?searchTerm=${q}&warehouseId=${a}`); const d=await r.json(); const i=d.items||d; l.empty(); searchResults={}; 
        if(i.length>0) {
            l.show();
            i.forEach(p => {
                searchResults[p.id]=p;
                const stock = parseFloat(p.stock) || 0;
                const unit = p.unitOfMeasure || 'UNI';
                let stockHtml = `Stock: ${stock.toFixed(2)} | ${unit}`;
                let noStockBadge = '';
                
                let itemClass = "autocomplete-item";
                let clickActionInfo = `onclick="seleccionarProductoDeLista('${p.id}')"`;
                let clickActionSelector = `onclick="agregarProductoMultiple('${p.id}', this)"`;
                
                const estaEnTabla = $('#nv_tablaProductos tr[data-id="' + p.id + '"]').length > 0 ? ' added' : '';

                if (stock <= 0) {
                    itemClass += " disabled-item"; 
                    noStockBadge = `<span style="background:#ef4444; color:white; font-size:10px; padding:2px 5px; border-radius:3px; margin-left:6px; font-weight:600;">Sin Stock</span>`;
                    clickActionInfo = "";     
                    clickActionSelector = ""; 
                }
                
                const itemHtml = `
                <div class="${itemClass}">
                    <div class="item-selector${estaEnTabla}" ${clickActionSelector} title="Seleccionar/Quitar">
                        <div class="selector-square"></div>
                    </div>
                    
                    <div class="item-info-clickable" ${clickActionInfo}>
                        <div style="display: flex; align-items: center;">
                            <span style="background:#f0f0f0; padding: 2px 6px; border-radius: 4px; font-weight: bold; font-size: 11px; border:1px solid #ddd; color:#555;">${p.code || 'S/C'}</span>
                            <span style="font-weight: 600; font-size: 13px; color:#333; margin-left:8px;">${p.name}</span>
                            ${noStockBadge}
                        </div>
                        <div style="font-size: 11px; color: #777; margin-top: 3px;">
                            ${stockHtml}
                        </div>
                    </div>
                </div>`;
                l.append(itemHtml);
            });
        } else { l.hide(); }
    } catch(e) { console.error(e); l.hide(); } 
}

function agregarProductoMultiple(id, element) {
    const p = searchResults[id];
    const existingRow = $(`#nv_tablaProductos tr[data-id="${p.id}"]`);

    if (existingRow.length > 0) {
        existingRow.remove();
        $(element).removeClass('added');
        toastr.info(`Removido: ${p.name}`);
        calcularTotalesGlobales();
        saveCurrentTabData(); 
    } else {
        if ((parseFloat(p.stock) || 0) > 0) {
            agregarProductoATabla(p, false); 
            $(element).addClass('added');
            toastr.success(`Agregado: ${p.name}`);
            saveCurrentTabData(); 
        }
    }
}

function seleccionarProductoDeLista(id){ 
    const p = searchResults[id]; 
    if(p && (parseFloat(p.stock) || 0) > 0) {
        agregarProductoATabla(p, true); 
        saveCurrentTabData(); 
    }
}

function agregarProductoATabla(prod, cerrarLista = true) {
    if(cerrarLista) { $('#listaProductos').hide(); $('#nv_buscarProducto').val(''); }
    
    if ($(`#nv_tablaProductos tr[data-id="${prod.id}"]`).length > 0) { 
        if(cerrarLista) toastr.error("Producto duplicado"); 
        return; 
    }
    
    const stock = parseFloat(prod.stock) || 0;
    if (stock <= 0) { toastr.error("Stock insuficiente"); return; }

    const rowId = Date.now();
    
    const row = `<tr id="row_${rowId}" data-id="${prod.id}">
        <td><div style="font-weight:700;color:#333;">${prod.code||''}</div><small style="color:#666;font-size:12px;">${prod.name}</small></td>
        <td>${prod.unitOfMeasure||'UNI'}</td>
        <td class="text-center" style="color: #000; font-weight:700;">${stock}</td>
        
        <td><div class="input-container"><input type="number" class="input-table qty" value="0" min="0.01" step="any" oninput="calcularFila('${rowId}')"><span class="row-error-msg">Requerido</span></div></td>
        <td><div class="input-container"><div style="display:flex;align-items:center;width:100%;"><input type="number" class="input-table val" value="0" min="0.01" step="any" oninput="calcularFila('${rowId}')"></div><span class="row-error-msg">Requerido</span></div></td>
        
        <td class="text-right subtotal">0.00</td><td class="text-right igv">0.00</td><td class="text-right total" style="font-weight:bold;">0.00</td>
        <td class="text-center"><button class="btn-delete-row" onclick="eliminarFila('${rowId}')"><i class='bx bx-trash'></i></button></td></tr>`;
    $('#nv_tablaProductos').append(row); calcularFila(rowId);
}

function calcularFila(rowId) {
    const $row = $(`#row_${rowId}`);
    let qty = parseFloat($row.find('.qty').val()); let unitPrice = parseFloat($row.find('.val').val());
    if (isNaN(qty) || qty < 0) qty = 0; if (isNaN(unitPrice) || unitPrice < 0) unitPrice = 0;
    
    const total = qty * unitPrice;
    const subtotal = total / 1.18;
    const igv = total - subtotal;

    $row.find('.subtotal').text(`${formatoMoneda(subtotal)}`); 
    $row.find('.igv').text(`${formatoMoneda(igv)}`); 
    $row.find('.total').text(`${formatoMoneda(total)}`);
    calcularTotalesGlobales();
}

function calcularTotalesGlobales() {
    let globalSubtotal = 0; let globalIGV = 0; let globalTotal = 0;
    $('#nv_tablaProductos tr').each(function() {
        const row = $(this);
        const sub = parseFloat(row.find('.subtotal').text().replace(/,/g,'')) || 0;
        const igv = parseFloat(row.find('.igv').text().replace(/,/g,'')) || 0;
        const tot = parseFloat(row.find('.total').text().replace(/,/g,'')) || 0;
        globalSubtotal += sub; globalIGV += igv; globalTotal += tot;
    });
    $('#nv_txtSubTotal').text(`${formatoMoneda(globalSubtotal)}`); 
    $('#nv_txtIGV').text(`${formatoMoneda(globalIGV)}`); 
    $('#nv_txtNoGravado').text(`0.00`); 
    $('#nv_txtTotal').text(`${formatoMoneda(globalTotal)}`);
}
function eliminarFila(id){ $(`#row_${id}`).remove(); calcularTotalesGlobales(); saveCurrentTabData(); }

function guardarVenta() {
    let isValid = true;
    ['nv_almacen', 'nv_tipoDoc', 'nv_moneda'].forEach(id => { if(!$(`#${id}`).val()) { $(`#${id}`).addClass('error'); $(`#${id}`).siblings('.error-message').addClass('show'); isValid = false; } });
    if(!$('#nv_idCliente').val()){ $('#nv_buscarCliente').addClass('error'); $('#error_nv_cliente').addClass('show'); isValid = false; }
    if(!isValid) { toastr.error("Corrija errores"); return; }
    if($('#nv_tablaProductos tr').length === 0) { toastr.warning("Agregue productos"); return; }

    let gravadoId = "";
    const gravadoObj = igvListCache.find(x => x.description.toLowerCase().includes('gravado'));
    gravadoId = gravadoObj ? gravadoObj.id : (igvListCache[0]?.id || "");

    let pErr = false; const det = [];
    $('#nv_tablaProductos tr').each(function() {
        const r = $(this); const qI = r.find('.qty'); const vI = r.find('.val');
        const q = parseFloat(qI.val()); const v = parseFloat(vI.val());
        if(isNaN(q)||q<=0){ qI.addClass('error'); qI.siblings('.row-error-msg').text("Requerido (>0)").show(); pErr=true; }
        if(isNaN(v)||v<=0){ vI.addClass('error'); vI.closest('.input-container').find('.row-error-msg').text("Requerido (>0)").show(); pErr=true; }
        det.push({ productId: r.data('id'), igvTypeId: gravadoId, quantity: q, unitPrice: v });
    });
    if(pErr){ toastr.error("Revise casillas rojas"); return; }

    const btn = $('#modalNuevaVenta .btn-save-modal'); const txt = btn.html(); btn.prop('disabled', true).html("<i class='bx bx-loader-alt bx-spin'></i> Guardando...");
    
    const payload = {
        warehouseId: $('#nv_almacen').val(), voucherTypeId: $('#nv_tipoDoc').val(), currencyId: $('#nv_moneda').val(), personId: $('#nv_idCliente').val(),
        issueDate: new Date().toISOString(), details: det
    };

    fetch(EP_SALE, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    .then(async res => {
        let d = null; try{d=await res.json();}catch(e){}
        if(res.ok){ 
            toastr.success(d?.message||"Venta registrada"); 
            
            // CERRAR SOLO LA PESTAÑA ACTUAL AL GUARDAR
            // Si quedan más pestañas, el modal sigue abierto.
            // Si era la última, el modal se cierra.
            closeTab(activeTabId);
            
            fetchVentas(currentPage); 
        }
        else{ 
            if(d?.errors && Array.isArray(d.errors)) { d.errors.forEach(err => toastr.error(err)); } 
            else if (d?.message) { toastr.error(d.message); } 
            else { toastr.error("Error al guardar."); }
            btn.prop('disabled',false).html(txt); 
        }
    }).catch(e=>{ toastr.error("Error conexión"); btn.prop('disabled',false).html(txt); });
}

async function abrirModalCrearCliente() {
    $('#modalCrearCliente').css('display', 'flex');
    $('#formNuevoCliente')[0].reset();
    $('.form-control').removeClass('error');
    $('.error-message').removeClass('show');
    
    try {
        const res = await fetch(EP_DOC_TYPES);
        const data = await res.json();
        const $sel = $('#ncli_tipoDoc'); $sel.empty();
        $sel.append('<option value="">Seleccionar...</option>');
        
        data.forEach(item => {
            const txt = item.description || item.name || item.text;
            const safeTxt = (txt || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
            $sel.append(`<option value="${item.id}" data-name="${safeTxt}">${txt}</option>`);
        });
    } catch(e) { console.error(e); }
}

function validarReglasDocumento() {
    const select = document.getElementById('ncli_tipoDoc');
    const input = document.getElementById('ncli_numeroDoc');
    const errorSpan = document.getElementById('error_ncli_numeroDoc');
    
    if(!select || !input) return true;

    const selectedOption = select.options[select.selectedIndex];
    const tipoNombre = selectedOption ? (selectedOption.getAttribute('data-name') || '') : '';
    const valor = input.value.trim();

    input.classList.remove('error');
    errorSpan.classList.remove('show');

    if (!valor) return false;

    if (tipoNombre.includes('DNI') && valor.length !== 8) {
        input.classList.add('error');
        errorSpan.textContent = `Debe tener 8 dígitos`;
        errorSpan.classList.add('show');
        return false;
    } 
    else if (tipoNombre.includes('RUC') && valor.length !== 11) {
        input.classList.add('error');
        errorSpan.textContent = `Debe tener 11 dígitos`;
        errorSpan.classList.add('show');
        return false;
    }
    // Si no es ni DNI ni RUC (ej. Documento Tributario), es válido siempre que no esté vacío (validado por el maxlength del input)
    return true;
}

async function guardarNuevoCliente() {
    let isValid = true;
    ['ncli_tipoDoc', 'ncli_numeroDoc', 'ncli_nombre'].forEach(id => {
        if(!$(`#${id}`).val()) { $(`#${id}`).addClass('error'); $(`#error_${id}`).addClass('show'); isValid = false; }
    });

    if(!isValid || !validarReglasDocumento()) {
        toastr.error("Complete el formulario correctamente");
        return;
    }

    const payload = {
        documentTypeId: $('#ncli_tipoDoc').val(),
        documentNumber: $('#ncli_numeroDoc').val().trim(),
        name: $('#ncli_nombre').val().trim(),
        email: $('#ncli_email').val().trim() || null,
        phone: $('#ncli_telefono').val().trim() || null,
        address: $('#ncli_direccion').val().trim() || null
    };

    const $btn = $('#modalCrearCliente .btn-save-modal');
    $btn.prop('disabled', true).text('Guardando...');

    try {
        const r = await fetch(EP_PERSON, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(payload)
        });

        const d = await r.json();

        if(r.ok) {
            toastr.success("Cliente registrado exitosamente");
            cerrarModal('modalCrearCliente');
            const docLabel = $("#ncli_tipoDoc option:selected").text();
            if(d.id) {
                seleccionarCliente(d.id, `${docLabel}: ${payload.documentNumber} - ${payload.name}`);
            } else {
                buscarPersona(payload.documentNumber);
            }

        } else {
            if(d.errors) d.errors.forEach(e => toastr.error(e));
            else if(d.message) toastr.error(d.message);
            else toastr.error("Error al guardar cliente");
        }
    } catch(e) {
        toastr.error("Error de conexión");
        console.error(e);
    } finally {
        $btn.prop('disabled', false).html('Guardar');
    }
}

async function abrirModalCrearProducto() { $('#modalCrearProducto').css('display','flex'); cargarDropdown(EP_UNIT,'np_unidad');cargarDropdown(EP_IGV,'np_igv');cargarDropdown(EP_CATEGORY,'np_categoria'); $('#formNuevoProducto')[0].reset(); $('.form-control').removeClass('error'); $('.error-message').removeClass('show'); }
async function guardarNuevoProducto() { let v=true; ['np_codigo','np_nombre','np_unidad','np_igv','np_categoria','np_precioVenta'].forEach(i=>{if(!$(`#${i}`).val()){$(`#${i}`).addClass('error');$(`#error_${i}`).addClass('show');v=false;}else{$(`#${i}`).removeClass('error');$(`#error_${i}`).removeClass('show');}}); if(!v){toastr.error("Faltan datos");return;} const p={code:$('#np_codigo').val(),name:$('#np_nombre').val(),description:$('#np_descripcion').val(),unitOfMeasureId:$('#np_unidad').val(),igvTypeId:$('#np_igv').val(),categoryId:$('#np_categoria').val(),purchasePrice:parseFloat($('#np_precioCompra').val())||0,salePrice:parseFloat($('#np_precioVenta').val())||0}; try{const r=await fetch(EP_PRODUCT_CRUD,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(p)}); if(r.ok){toastr.success("Producto creado");cerrarModal('modalCrearProducto');}else{const e=await r.json();toastr.error(e.message||"Error al crear");}}catch{toastr.error("Error conexión");} }

// ==========================================
// NUEVA LÓGICA: CREAR CATEGORÍA EN EL MODAL
// ==========================================
function abrirModalNuevaCategoria() {
    // Usamos fadeIn (que usa JQuery) porque así se manejan los otros modales
    $('#modalNuevaCategoria').fadeIn(200).css('display', 'flex');
    $('#formNuevaCategoria')[0].reset();
    $('#ncat_nombre').removeClass('error');
    $('#error_ncat_nombre').removeClass('show');
}

async function guardarNuevaCategoria() {
    const nombreInput = $('#ncat_nombre');
    const descInput = $('#ncat_descripcion');
    const errorMsg = $('#error_ncat_nombre');
    
    const nombre = nombreInput.val().trim();
    
    if (!nombre) {
        nombreInput.addClass('error');
        errorMsg.addClass('show');
        return;
    } else {
        nombreInput.removeClass('error');
        errorMsg.removeClass('show');
    }

    const payload = {
        name: nombre,
        description: descInput.val().trim() || null
    };

    const $btn = $('#modalNuevaCategoria .btn-save-modal');
    $btn.prop('disabled', true).text('Guardando...');

    try {
        const response = await fetch(EP_CATEGORY, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            toastr.success('Categoría creada correctamente');
            cerrarModal('modalNuevaCategoria');
            // Recargar el dropdown de categorías del modal de producto
            await cargarDropdown(EP_CATEGORY, 'np_categoria'); 
        } else {
            const errorData = await response.json();
            let msg = 'Error al crear categoría';
            if (errorData.errors && Array.isArray(errorData.errors)) msg = errorData.errors[0];
            else if (errorData.message) msg = errorData.message;
            toastr.error(msg);
        }
    } catch (error) {
        console.error(error);
        toastr.error('Error de conexión');
    } finally {
        $btn.prop('disabled', false).text('Guardar');
    }
}

// ==========================================
// FUNCIÓN CERRAR MODAL (ACTUALIZADA)
// ==========================================
function cerrarModal(id){
    $(`#${id}`).fadeOut(200);
    // Limpiar al cerrar si es el modal de nueva venta
    if (id === 'modalNuevaVenta') {
        limpiarFormularioVenta();
        salesTabs = []; // Reset tabs
    }
}

async function abrirModalDetalle(id) { if(!id) return; $('#modalDetalleVenta').css('display','flex'); $('#modalLoader').show(); $('#modalContentBody').hide(); try { const r = await fetch(`${EP_SALE}/${id}`); const d = await r.json(); $('#mv_tipoDoc').text(d.voucherType||'Venta'); $('#mv_serieNumero').text(d.voucherNumber||'-'); $('#mv_fechaEmision').text(formatearFechaPeru(d.issueDate,false)); $('#mv_cliente').text(d.personName||'-'); const dn=d.personDocumentNumber||''; let dt=d.personDocumentType||(dn.length===11?'RUC':'DNI'); $('#mv_docCliente').text(dn?`${dt}: ${dn}`:'-'); $('#mv_almacen').text(d.warehouse||'-'); $('#mv_moneda').text(d.currency||'-'); $('#mv_fechaRegistro').text(formatearFechaPeru(d.createdDate||d.issueDate,true)); const t=$('#modalTableBody'); t.empty(); if(d.details){ d.details.forEach(i=>{ t.append(`<tr><td><span style="background:#f4f4f4;padding:2px 6px;border-radius:4px;border:1px solid #ddd;font-weight:600">${i.productCode||'-'}</span></td><td><strong>${i.productName||'-'}</strong></td><td>${i.unitOfMeasure||'UNI'}</td><td>${i.igvType||'-'}</td><td class="text-right">${(i.quantity||0).toFixed(2)}</td><td class="text-right">${formatoMoneda(i.unitPrice)}</td><td class="text-right">${formatoMoneda(i.amount)}</td><td class="text-right">${formatoMoneda(i.taxAmount)}</td><td class="text-right"><strong>${formatoMoneda(i.lineTotal)}</strong></td></tr>`); }); } $('#mv_totalNoGravado').text(`${formatoMoneda(d.exempt)}`); $('#mv_totalSubtotal').text(`${formatoMoneda(d.subTotal)}`); $('#mv_totalIgv').text(`${formatoMoneda(d.taxAmount)}`); $('#mv_totalFinal').text(`${formatoMoneda(d.total)}`); $('#modalLoader').hide(); $('#modalContentBody').fadeIn(200); } catch(e) { toastr.error("Error al cargar"); cerrarModal('modalDetalleVenta'); } }

// ===============================================
// GESTIÓN DE CLICS FUERA DE MODAL (BLOQUEO)
// ===============================================
$(window).click(e => {
    if ($(e.target).hasClass('modal-overlay')) {
        // IDs de los modales que NO deben cerrarse al hacer clic fuera
        const modalesBloqueados = ['modalNuevaVenta', 'modalCrearCliente', 'modalCrearProducto', 'modalNuevaCategoria'];
        const idActual = $(e.target).attr('id');

        // Si el ID del modal clickeado está en la lista de bloqueados, no hacer nada (no cerrar)
        if (modalesBloqueados.includes(idActual)) {
            return; 
        }

        // Si no está bloqueado (ej: Detalle), cerrar normal
        $(e.target).fadeOut(200);
    }
});