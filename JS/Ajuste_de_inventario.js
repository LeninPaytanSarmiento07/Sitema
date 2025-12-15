const API_BASE = "https://posapi2025new-augrc0eshqgfgrcf.canadacentral-01.azurewebsites.net/api";

// ENDPOINTS
const EP_ADJUSTMENT = `${API_BASE}/InventoryAdjustment`; // Para Listar, Crear y Ver Detalle (con /id)
const EP_WAREHOUSE = `${API_BASE}/Warehouse/select`;
const EP_ADJ_TYPE = `${API_BASE}/InventoryAdjustmentType/select`;
const EP_PRODUCT_SEARCH = `${API_BASE}/Product/search`;

let currentPage = 1;
let pageSize = 10;
let totalPages = 1;
let warehouseId = "";
let adjustmentTypesCache = [];
let searchResults = {};
let searchTimer = null;

// NUEVAS VARIABLES PARA FECHA
let startDate = "";
let endDate = "";

toastr.options = { "closeButton": true, "positionClass": "toast-bottom-right", "timeOut": "5000", "preventDuplicates": false };

$(document).ready(function() {
    loadWarehouses();
    loadAdjustmentTypes();

    $('#btnPrev').click(() => cambiarPagina(-1));
    $('#btnNext').click(() => cambiarPagina(1));
    $('#btnFirst').click(() => irAPagina(1));
    $('#btnLast').click(() => irAPagina(totalPages));
    $('#pageSizeSelect').on('change', function() { pageSize = parseInt($(this).val()); currentPage = 1; fetchAjustes(currentPage); });
    
    $('#warehouseSelect').on('change', function() { warehouseId = $(this).val(); currentPage = 1; fetchAjustes(currentPage); });

    // BUSCADOR EN MODAL
    $('#na_buscarProducto').on('input', function() {
        const val = $(this).val().trim();
        const modalWarehouse = $('#na_almacen').val();
        
        if(!modalWarehouse) {
            toastr.warning("Seleccione un almacén primero");
            $(this).val('');
            return;
        }

        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => { buscarProducto(val, modalWarehouse); }, 300);
    });

    $(document).on('input', '.form-control', function() { $(this).removeClass('error'); $(this).siblings('.error-message').removeClass('show'); });
    $(document).click(function(e) { if (!$(e.target).closest('.autocomplete-wrapper').length) { $('.autocomplete-list').hide(); } });
    
    $('#na_almacen').on('change', function() { $('#na_tablaDetalles').empty(); $('#na_buscarProducto').val(''); });

    // ==========================================
    // LÓGICA DE FILTROS DE FECHA (CON X)
    // ==========================================
    
    $('#startDate').on('change', function() {
        startDate = $(this).val();
        // Mostrar/Ocultar X
        if(startDate) $('#clearStartDate').show();
        else $('#clearStartDate').hide();
        
        currentPage = 1;
        fetchAjustes(currentPage);
    });

    $('#endDate').on('change', function() {
        endDate = $(this).val();
        // Mostrar/Ocultar X
        if(endDate) $('#clearEndDate').show();
        else $('#clearEndDate').hide();

        currentPage = 1;
        fetchAjustes(currentPage);
    });

    // Botones "X" para limpiar
    $('#clearStartDate').click(function() {
        $('#startDate').val('');
        startDate = "";
        $(this).hide(); // Ocultar X
        currentPage = 1;
        fetchAjustes(currentPage);
    });

    $('#clearEndDate').click(function() {
        $('#endDate').val('');
        endDate = "";
        $(this).hide(); // Ocultar X
        currentPage = 1;
        fetchAjustes(currentPage);
    });
});

function formatearFecha(f) { 
    if (!f) return '-'; 
    const d = new Date(f); 
    return d.toLocaleString('es-PE', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }); 
}

// 1. CARGA INICIAL
async function loadWarehouses() {
    try {
        const r = await fetch(EP_WAREHOUSE); const d = await r.json(); 
        const s = $('#warehouseSelect'); const sm = $('#na_almacen');
        s.empty(); sm.empty();
        
        if (d.length > 0) {
            d.forEach((w, i) => { 
                const opt = `<option value="${w.id}">${w.name}</option>`;
                s.append(opt); sm.append(opt);
                if (i === 0) warehouseId = w.id; 
            });
            fetchAjustes(currentPage);
        }
    } catch (e) { console.error(e); toastr.error("Error al cargar almacenes"); }
}

async function loadAdjustmentTypes() {
    try { const r = await fetch(EP_ADJ_TYPE); adjustmentTypesCache = await r.json(); } catch(e){ console.error(e); }
}

// 2. FETCH AJUSTES (TABLA PRINCIPAL)
async function fetchAjustes(page) {
    const $tbody = $('#ajustesBody'); 
    $tbody.html('<tr><td colspan="5" class="text-center" style="padding: 20px;">Cargando...</td></tr>');
    
    try {
        if(!warehouseId) throw new Error("Sin almacén");
        
        // URL ACTUALIZADA CON STARTDATE Y ENDDATE
        const url = `${EP_ADJUSTMENT}?pageNumber=${page}&pageSize=${pageSize}&warehouseId=${warehouseId}&startDate=${startDate}&endDate=${endDate}`;
        
        const r = await fetch(url);
        if (!r.ok) throw new Error("Error del servidor");
        const d = await r.json();
        
        $tbody.empty(); const items = d.items || [];
        if (items.length === 0) { $tbody.html('<tr><td colspan="5" class="text-center" style="padding: 20px;">No se encontraron registros.</td></tr>'); return; }

        items.forEach(a => {
            $tbody.append(`<tr>
                <td>${formatearFecha(a.createdDate)}</td>
                <td style="color:#6b7280">${a.warehouse}</td>
                <td><span style="background:#eff6ff;color:#3b82f6;padding:4px 10px;border-radius:6px;font-weight:600;font-size:12px;">${a.number}</span></td>
                <td>${a.reason}</td>
                <td class="text-center"><button class="btn-action" onclick="verDetalle('${a.id}')"><i class='bx bx-show'></i></button></td>
            </tr>`);
        });

        currentPage = d.pageNumber; totalPages = d.totalPages;
        $('#lblStart').text((currentPage - 1) * pageSize + 1); $('#lblEnd').text(Math.min(currentPage * pageSize, d.totalCount)); $('#lblTotal').text(d.totalCount); $('#btnPageDisplay').text(`${currentPage} / ${totalPages}`);
        $('#btnPrev').prop('disabled', !d.hasPreviousPage); $('#btnFirst').prop('disabled', !d.hasPreviousPage); $('#btnNext').prop('disabled', !d.hasNextPage); $('#btnLast').prop('disabled', !d.hasNextPage);

    } catch (e) { console.error(e); $tbody.html('<tr><td colspan="5" class="text-center text-danger">Error al cargar datos</td></tr>'); }
}

function cambiarPagina(d) { const p = currentPage + d; if (p >= 1 && p <= totalPages) fetchAjustes(p); }
function irAPagina(p) { if (p >= 1 && p <= totalPages) fetchAjustes(p); }

// 3. DETALLE AJUSTE
async function verDetalle(id) {
    $('#modalDetalleAjuste').css('display', 'flex');
    $('#loaderDetalle').show(); $('#contenidoDetalle').hide();
    
    try {
        const r = await fetch(`${EP_ADJUSTMENT}/${id}`);
        if (!r.ok) throw new Error("No se pudo obtener el detalle");
        const d = await r.json();
        
        $('#da_numero').text(d.number || '-'); 
        $('#da_almacen').text(d.warehouse || '-');
        $('#da_fecha').text(formatearFecha(d.createdDate)); 
        $('#da_motivo').text(d.reason || '-');
        
        const $tb = $('#da_tablaBody'); $tb.empty();
        if(d.details && Array.isArray(d.details)){
            d.details.forEach(det => {
                $tb.append(`<tr>
                    <td><span style="background:#f4f4f4;padding:2px 6px;border-radius:4px;font-weight:600;font-size:12px;">${det.productCode || '-'}</span></td>
                    <td><strong>${det.productName || '-'}</strong></td>
                    <td>${det.unitOfMeasure || '-'}</td>
                    <td>${det.inventoryAdjustmentType || '-'}</td>
                    <td class="text-right font-bold">${parseFloat(det.quantity).toFixed(2)}</td>
                    <td>${det.reason || '-'}</td>
                </tr>`);
            });
        }
        $('#loaderDetalle').hide(); $('#contenidoDetalle').fadeIn();
    } catch(e) { 
        console.error(e);
        toastr.error("Error al cargar detalle"); 
        cerrarModal('modalDetalleAjuste'); 
    }
}

// 4. NUEVO AJUSTE
function abrirModalNuevoAjuste() {
    $('#modalNuevoAjuste').css('display', 'flex');
    $('#na_almacen').val(warehouseId);
    $('#na_motivo').val('');
    $('#na_tablaDetalles').empty();
    $('#na_buscarProducto').val('');
    $('.form-control').removeClass('error'); $('.error-message').removeClass('show');
    
    const $btn = $('#modalNuevoAjuste .btn-save-modal');
    $btn.prop('disabled', false).html("<i class='bx bx-save'></i> Guardar Ajuste");
}

async function buscarProducto(term, warehouse) {
    const l = $('#listaProductos');
    if(term.length < 1) { l.hide(); return; }
    
    try {
        const r = await fetch(`${EP_PRODUCT_SEARCH}?searchTerm=${term}&warehouseId=${warehouse}`);
        const d = await r.json();
        const items = d.items || d;
        l.empty(); searchResults = {};

        if (items.length > 0) {
            l.show();
            items.forEach(p => {
                searchResults[p.id] = p;
                const stock = parseFloat(p.stock) || 0;
                l.append(`<div class="autocomplete-item" onclick="agregarProducto('${p.id}')">
                    <div><strong>${p.name}</strong> <small>(${p.code})</small></div>
                    <div><span class="stock-val">Stock: ${stock}</span></div>
                </div>`);
            });
        } else { l.hide(); }
    } catch(e) { console.error(e); l.hide(); }
}

function agregarProducto(id) {
    $('#listaProductos').hide(); $('#na_buscarProducto').val('');
    const p = searchResults[id];
    if ($(`#na_tablaDetalles tr[data-id="${p.id}"]`).length > 0) { toastr.warning("Producto ya agregado"); return; }

    const stock = parseFloat(p.stock) || 0;
    
    let options = '';
    adjustmentTypesCache.forEach(t => {
        options += `<option value="${t.id}">${t.description}</option>`;
    });

    const rowId = Date.now();
    const row = `<tr id="row_${rowId}" data-id="${p.id}" data-stock="${stock}">
        <td>
            <div style="font-weight:600;">${p.name}</div>
            <small style="color:#666;">${p.code}</small>
        </td>
        <td class="text-center stock-val">${stock}</td>
        <td>
            <select class="form-control adj-type">${options}</select>
        </td>
        <td>
            <input type="number" class="form-control qty" value="1" min="0.01" step="any">
        </td>
        <td>
            <input type="text" class="form-control reason" placeholder="Razón...">
        </td>
        <td class="text-center">
            <button class="btn-delete-row" onclick="$('#row_${rowId}').remove()"><i class='bx bx-trash'></i></button>
        </td>
    </tr>`;
    
    $('#na_tablaDetalles').append(row);
}

function guardarAjuste() {
    let isValid = true;
    const whId = $('#na_almacen').val();
    const reasonGlobal = $('#na_motivo').val().trim();

    if(!whId) { $('#na_almacen').addClass('error'); isValid=false; }
    if(!reasonGlobal) { $('#na_motivo').addClass('error'); $('#error_na_motivo').addClass('show'); isValid=false; }
    
    if(!isValid) { toastr.error("Complete los campos obligatorios"); return; }
    if($('#na_tablaDetalles tr').length === 0) { toastr.warning("Agregue al menos un producto"); return; }

    const details = [];
    let stockError = false;

    $('#na_tablaDetalles tr').each(function() {
        const row = $(this);
        const prodId = row.data('id');
        const currentStock = parseFloat(row.data('stock'));
        const typeId = row.find('.adj-type').val();
        const typeText = row.find('.adj-type option:selected').text().toLowerCase();
        const qtyInput = row.find('.qty');
        const qty = parseFloat(qtyInput.val());
        const rowReason = row.find('.reason').val().trim();

        if (isNaN(qty) || qty <= 0) {
            qtyInput.addClass('error');
            isValid = false;
        }

        if ((typeText.includes('disminuir') || typeText.includes('salida')) && qty > currentStock) {
            qtyInput.addClass('error');
            toastr.error(`Stock insuficiente para ${row.find('div').text()} (Stock: ${currentStock})`);
            stockError = true;
        }

        details.push({
            productId: prodId,
            inventoryAdjustmentTypeId: typeId,
            quantity: qty,
            reason: rowReason || null
        });
    });

    if (!isValid || stockError) return;

    const $btn = $('#modalNuevoAjuste .btn-save-modal');
    const originalText = $btn.html();
    $btn.prop('disabled', true).html("<i class='bx bx-loader-alt bx-spin'></i> Guardando...");

    const payload = {
        warehouseId: whId,
        reason: reasonGlobal,
        details: details
    };

    fetch(EP_ADJUSTMENT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    })
    .then(async res => {
        let d = null; try { d = await res.json(); } catch(e){}
        if(res.ok) {
            toastr.success("Ajuste registrado correctamente");
            cerrarModal('modalNuevoAjuste');
            fetchAjustes(currentPage);
        } else {
            if(d?.errors) d.errors.forEach(e => toastr.error(e));
            else if(d?.message) toastr.error(d.message);
            else toastr.error("Error al guardar ajuste");
            $btn.prop('disabled', false).html(originalText);
        }
    })
    .catch(e => {
        toastr.error("Error de conexión");
        $btn.prop('disabled', false).html(originalText);
    });
}

function cerrarModal(id) { $(`#${id}`).fadeOut(200); }
$(window).click(function(e) { if ($(e.target).hasClass('modal-overlay')) $(e.target).fadeOut(200); });