const API_BASE = "https://posapi2025new-augrc0eshqgfgrcf.canadacentral-01.azurewebsites.net/api";

// ENDPOINTS
const EP_PURCHASE = `${API_BASE}/Purchase`;
// Nuevo endpoint para No Domiciliados
const EP_PURCHASE_NON_DOMICILED = "https://posapi2025new-augrc0eshqgfgrcf.canadacentral-01.azurewebsites.net/api/Purchase/non-domiciled";

const EP_WAREHOUSE = `${API_BASE}/Warehouse/select`; 
const EP_VOUCHER = `${API_BASE}/VoucherType/select`; 
const EP_CURRENCY = `${API_BASE}/Currency/select`;   
const EP_PERSON = `${API_BASE}/Person`; 
const EP_PRODUCT = `${API_BASE}/Product`; 
const EP_UNIT = `${API_BASE}/UnitOfMeasure`;
const EP_IGV = `${API_BASE}/IGVType`;
const EP_CATEGORY = `${API_BASE}/Category`;
const EP_DOC_TYPES = `${API_BASE}/DocumentType/select`;

let currentPage = 1;
let pageSize = 10;
let totalPages = 1;
let searchTerm = "";
let warehouseId = "";
// Nuevas variables para fechas
let startDate = "";
let endDate = "";

let cachedIgvOptions = ""; 
let igvListCache = []; 
let searchResults = {}; 
let searchTimer = null; 

// CONFIGURACIÓN TOASTR
toastr.options = {
    "closeButton": true, "debug": false, "newestOnTop": false, "progressBar": true,
    "positionClass": "toast-bottom-right", "preventDuplicates": false, "timeOut": "5000"
};

$(document).ready(function() {
    loadWarehouses();

    // APLICAR CAMBIO SOLICITADO: MÁXIMO 25 DÍGITOS EN MODAL CREAR PROVEEDOR
    $('#nprov_numeroDoc').attr('maxlength', '25');

    $('#btnPrev').click(() => cambiarPagina(-1));
    $('#btnNext').click(() => cambiarPagina(1));
    $('#btnFirst').click(() => irAPagina(1));
    $('#btnLast').click(() => irAPagina(totalPages));

    $('#pageSizeSelect').on('change', function() { 
        pageSize = parseInt($(this).val()); 
        currentPage = 1; 
        fetchCompras(currentPage); 
    });
    
    $('#searchInput').on('input', function() {
        const val = $(this).val().trim();
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => { searchTerm = val; currentPage = 1; fetchCompras(currentPage); }, 300); 
    });

    $('#warehouseSelect').on('change', function() { warehouseId = $(this).val(); currentPage = 1; fetchCompras(currentPage); });

    // BUSCADORES EN MODAL
    $('#nc_buscarProveedor').on('input focus', function() { buscarPersona($(this).val()); });
    $('#nc_buscarProducto').on('input focus', function() { buscarProducto($(this).val()); });
    
    $('#btnLimpiarProveedor').click(function() {
        $('#nc_buscarProveedor').val('').focus();
        $('#nc_idProveedor').val('');
        $(this).hide();
    });

    $('.form-control').on('input change', function() { $(this).removeClass('error'); $(this).siblings('.error-message').removeClass('show'); });
    $(document).on('input', '.input-table', function() { 
        const val = parseFloat($(this).val());
        if(!isNaN(val) && val > 0) { $(this).removeClass('error'); $(this).closest('.input-container').find('.row-error-msg').hide(); }
    });

    $(document).click(function(e) { if (!$(e.target).closest('.autocomplete-wrapper').length) { $('.autocomplete-list').hide(); } });

    // =========================================================================
    // LÓGICA CORREGIDA PARA INPUT DE N° DOCUMENTO (PROVEEDOR)
    // =========================================================================
    $('#nprov_numeroDoc').on('input', function(e) {
        // Obtenemos el texto del tipo seleccionado
        const tipoDocText = $('#nprov_tipoDoc option:selected').text().toUpperCase();
        
        // Solo forzamos "Solo Números" si es DNI o RUC
        // Para "Documento tributario" u otros, permitimos caracteres (letras/números)
        if (tipoDocText.includes('DNI') || tipoDocText.includes('RUC')) {
            e.target.value = e.target.value.replace(/\D/g, ''); 
        }
        
        // La validación de longitud se maneja abajo y con el maxlength=25
        validarReglasDocumento();
    });
    
    $('#nprov_tipoDoc').on('change', function() {
        $('#nprov_numeroDoc').val('').focus();
        $('#nprov_numeroDoc').removeClass('error');
        $('#error_nprov_numeroDoc').removeClass('show');
    });

    // ==========================================
    // NUEVA LÓGICA: DETECTAR "NO DOMICILIADO"
    // ==========================================
    $('#nc_tipoDoc').on('change', function() {
        const selectedText = $(this).find("option:selected").text().toLowerCase();
        const isNoDomiciliado = selectedText.includes("no domiciliado");
        
        const $serie = $('#nc_serie');
        const $numero = $('#nc_numero');
        const $errorSerie = $('#error_nc_serie');
        const $errorNumero = $('#error_nc_numero');

        if (isNoDomiciliado) {
            // 1. Bloquear, limpiar y CAMBIAR COLOR a gris
            $serie.prop('disabled', true)
                  .val('')
                  .removeClass('error')
                  .css('background-color', '#e9ecef'); // Color gris visual
            
            $errorSerie.removeClass('show');

            // 2. Cambiar validación de Número a 20 caracteres
            $numero.attr('maxlength', '20');
            $errorNumero.text('Requerido (Máx 20)'); 
        } else {
            // Restaurar comportamiento normal y COLOR blanco
            $serie.prop('disabled', false)
                  .css('background-color', '#fff'); // Restaurar blanco
            
            $numero.attr('maxlength', '8');
            $errorNumero.text('Requerido (Máx 8)');
            
            // Si el usuario había escrito más de 8 y cambia el tipo, cortamos el excedente
            if($numero.val().length > 8) {
                $numero.val($numero.val().substring(0, 8));
            }
        }
    });

    // ==========================================
    // LOGICA DE FILTROS DE FECHA (CON X)
    // ==========================================
    
    $('#startDate').on('change', function() {
        startDate = $(this).val();
        if(startDate) $('#clearStartDate').show();
        else $('#clearStartDate').hide();
        currentPage = 1;
        fetchCompras(currentPage);
    });

    $('#endDate').on('change', function() {
        endDate = $(this).val();
        if(endDate) $('#clearEndDate').show();
        else $('#clearEndDate').hide();
        currentPage = 1;
        fetchCompras(currentPage);
    });

    $('#clearStartDate').click(function() {
        $('#startDate').val('');
        startDate = "";
        $(this).hide();
        currentPage = 1;
        fetchCompras(currentPage);
    });

    $('#clearEndDate').click(function() {
        $('#endDate').val('');
        endDate = "";
        $(this).hide();
        currentPage = 1;
        fetchCompras(currentPage);
    });
});

function formatoMoneda(valor) {
    if (valor === undefined || valor === null) return "0.00";
    return parseFloat(valor).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatearFechaPeru(fechaISO, incluirHora = false) {
    if (!fechaISO) return '-';
    const fecha = new Date(fechaISO);
    const opciones = { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'America/Lima' };
    if (incluirHora) { opciones.hour = '2-digit'; opciones.minute = '2-digit'; opciones.second = '2-digit'; opciones.hour12 = false; }
    return fecha.toLocaleString('es-PE', opciones);
}

// 1. CARGA INICIAL
async function loadWarehouses() {
    try {
        const response = await fetch(EP_WAREHOUSE);
        const data = await response.json();
        const $select = $('#warehouseSelect'); $select.empty(); 
        if (data.length > 0) {
            data.forEach((w, index) => { $select.append(`<option value="${w.id}">${w.name}</option>`); if (index === 0) warehouseId = w.id; });
            fetchCompras(currentPage);
        }
    } catch (error) { console.error(error); }
}

async function fetchCompras(page) {
    const $tbody = $('#comprasBody'); $tbody.html('<tr><td colspan="8" class="text-center" style="padding: 20px;">Cargando...</td></tr>');
    try {
        // Incluimos startDate y endDate en la URL
        const url = `${EP_PURCHASE}?pageNumber=${page}&pageSize=${pageSize}&searchTerm=${searchTerm}&warehouseId=${warehouseId}&startDate=${startDate}&endDate=${endDate}`;
        const response = await fetch(url); const data = await response.json();
        $tbody.empty(); const items = data.items || [];
        if (items.length === 0) { $tbody.html('<tr><td colspan="8" class="text-center" style="padding: 20px;">No se encontraron resultados.</td></tr>'); return; }
        
        items.forEach((compra) => {
            const fecha = formatearFechaPeru(compra.issueDate, false);
            const docNum = compra.personDocumentNumber || '';
            
            // --- CAMBIO SOLICITADO: Usar directamente "documentType" del JSON de la API ---
            let docLabel = compra.documentType || compra.personDocumentType || 'DOC';
            // -----------------------------------------------------------------------------------

            const serieNumero = compra.voucherNumber || '-';
            const totalFmt = formatoMoneda(compra.total);

            // SE ELIMINÓ S/
            const row = `<tr>
                <td style="font-weight: 500;">${fecha}</td>
                <td style="color: #6b7280;">${compra.warehouse || '-'}</td>
                <td><span style="background: #1f2937; color: white; padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: 600;">${compra.voucherType || 'Doc'}</span></td>
                <td><span style="background: #eff6ff; color: #3b82f6; padding: 4px 10px; border-radius: 6px; font-size: 13px; font-weight: 600; border: 1px solid #dbeafe;">${serieNumero}</span></td>
                <td><div style="font-weight: 600; color: #111827;">${compra.personName || 'Sin Nombre'}</div><div style="font-size: 11px; color: #6b7280; margin-top:2px;"><strong>${docLabel}:</strong> ${docNum}</div></td>
                <td style="color: #4b5563;">${compra.currency || '-'}</td>
                <td style="font-weight: 700; color: #111827;">${totalFmt}</td>
                <td class="text-center"><button class="btn-action" onclick="abrirModalDetalle('${compra.id}')"><i class='bx bx-show'></i></button></td>
            </tr>`;
            $tbody.append(row);
        });

        currentPage = data.pageNumber; 
        totalPages = data.totalPages;
        const totalCount = data.totalCount;

        $('#lblStart').text((currentPage - 1) * pageSize + 1);
        $('#lblEnd').text(Math.min(currentPage * pageSize, totalCount));
        $('#lblTotal').text(totalCount);
        $('#btnPageDisplay').text(`${currentPage} / ${totalPages}`);

        $('#btnPrev').prop('disabled', !data.hasPreviousPage);
        $('#btnFirst').prop('disabled', !data.hasPreviousPage);
        $('#btnNext').prop('disabled', !data.hasNextPage);
        $('#btnLast').prop('disabled', !data.hasNextPage);

    } catch (error) { console.error(error); }
}

function cambiarPagina(delta) { 
    const nuevaPagina = currentPage + delta; 
    if (nuevaPagina >= 1 && nuevaPagina <= totalPages) { 
        fetchCompras(nuevaPagina); 
    } 
}

function irAPagina(pagina) { 
    if (pagina >= 1 && pagina <= totalPages) { 
        fetchCompras(pagina); 
    } 
}

// ==========================================
// FUNCIÓN: LIMPIAR FORMULARIO COMPRA
// ==========================================
function limpiarFormularioCompra() {
    // 1. Limpiar Inputs
    $('#nc_serie').val('');
    $('#nc_numero').val('');
    $('#nc_buscarProveedor').val('');
    $('#nc_idProveedor').val('');
    $('#nc_buscarProducto').val('');
    
    // 2. Resetear Fecha
    document.getElementById('nc_fecha').valueAsDate = new Date();

    // 3. Ocultar botones UI
    $('#btnLimpiarProveedor').hide();
    $('#listaProveedores').hide();
    $('#listaProductos').hide();

    // 4. Vaciar Tabla
    $('#nc_tablaProductos').empty();

    // 5. Resetear Totales Visuales y Errores
    calcularTotalesGlobales();
    $('.form-control').removeClass('error');
    $('.error-message').removeClass('show');

    // 6. RESTAURAR ESTADO ORIGINAL
    $('#nc_serie').prop('disabled', false).css('background-color', '#fff'); // Restaurar color
    $('#nc_numero').attr('maxlength', '8');
    $('#error_nc_numero').text('Requerido (Máx 8)');
}

// 2. MODAL NUEVA COMPRA
async function abrirModalNuevaCompra() {
    $('#modalNuevaCompra').css('display', 'flex');
    limpiarFormularioCompra();
    
    const $btn = $('#modalNuevaCompra .btn-save-modal');
    $btn.prop('disabled', false).html("<i class='bx bx-save'></i> Guardar Compra");

    cargarDropdown(EP_WAREHOUSE, 'nc_almacen');
    
    // Cargar y luego Deshabilitar Boleta
    await cargarDropdown(EP_VOUCHER, 'nc_tipoDoc');
    $('#nc_tipoDoc option').each(function() {
        if($(this).text().toLowerCase().includes('boleta')) {
            $(this).prop('disabled', true);
        }
    });

    cargarDropdown(EP_CURRENCY, 'nc_moneda');
    await prepararOpcionesIGV();
}

// --- CAMBIO SOLICITADO: INICIALIZAR EN BLANCO ---
async function cargarDropdown(url, elementId) {
    try { 
        const res = await fetch(url); 
        const data = await res.json(); 
        const $el = $(`#${elementId}`); 
        $el.empty();
        
        // Agregar opción por defecto para que aparezca "Seleccionar..." al inicio
        $el.append('<option value="">Seleccionar...</option>');

        data.forEach(item => { 
            let val = item.id; 
            let txt = item.description || item.name || item.text || item.symbol || "Sin Nombre"; 
            $el.append(`<option value="${val}">${txt}</option>`); 
        });
    } catch (e) { console.error(e); }
}
// ------------------------------------------------

async function prepararOpcionesIGV() {
    try { const res = await fetch(EP_IGV); const data = await res.json();
        igvListCache = data; cachedIgvOptions = data.map(t=>`<option value="${t.id}">${t.description}</option>`).join('');
    } catch (error) { console.error(error); }
}

// =========================================================
//  LÓGICA BUSCADOR PROVEEDORES
// =========================================================
async function buscarPersona(texto) {
    const $list = $('#listaProveedores'); const term = texto || ""; 
    try { const res = await fetch(`${EP_PERSON}?searchTerm=${term}`); const data = await res.json(); const items = data.items || data;
        $list.empty();
        if (items.length > 0) {
            $list.show();
            items.forEach(p => {
                const docNum = p.documentNumber || '';
                let docLabel = p.documentType || (docNum.length === 11 ? "RUC" : "DNI");
                
                const itemHtml = `
                <div class="autocomplete-item">
                    <div class="item-info-clickable" style="width:100%" onclick="seleccionarProveedor('${p.id}', '${p.name}', '${docLabel}', '${docNum}')">
                        <div style="font-weight: 600; color: #333; font-size: 13px;">${p.name}</div>
                        <div style="color: #666; font-size: 11px; margin-top: 2px;">${docLabel}: ${docNum}</div>
                    </div>
                </div>`;
                
                $list.append(itemHtml);
            });
        } else { $list.hide(); }
    } catch (e) { $list.hide(); }
}

function seleccionarProveedor(id, nombre, tipoDoc, numDoc) {
    $('#nc_buscarProveedor').val(`${tipoDoc}: ${numDoc} - ${nombre}`);
    $('#nc_idProveedor').val(id);
    $('#btnLimpiarProveedor').show();
    $('#listaProveedores').hide();
    $('#nc_buscarProveedor').removeClass('error'); $('#error_nc_proveedor').removeClass('show');
}

// --------------------------------------------------------------------------------------
// LOGICA DE BUSQUEDA DE PRODUCTOS
// --------------------------------------------------------------------------------------
async function buscarProducto(texto) {
    const $list = $('#listaProductos'); 
    const almacenId = $('#nc_almacen').val();
    if (!almacenId) { $list.hide(); return; }
    const term = texto ? texto.trim() : "";
    if (term.length < 1) { $list.hide(); return; }

    try {
        const url = `${API_BASE}/Product/search?searchTerm=${term}&warehouseId=${almacenId}`;
        const res = await fetch(url);
        const data = await res.json();
        const items = data.items || data;
        $list.empty(); searchResults = {};

        if (items.length > 0) {
            $list.show();
            items.forEach(prod => {
                searchResults[prod.id] = prod;
                
                const stock = parseFloat(prod.stock) || 0;
                const unit = prod.unitOfMeasure || 'UNI';
                let stockHtml = `Stock: ${stock.toFixed(2)} | ${unit}`;
                let noStockBadge = '';
                
                if(stock <= 0) {
                     noStockBadge = `<span style="background:#ef4444; color:white; font-size:10px; padding:2px 5px; border-radius:3px; margin-left:6px; font-weight:600;">Sin Stock</span>`;
                }

                const estaEnTabla = $('#nc_tablaProductos tr[data-id="' + prod.id + '"]').length > 0 ? ' added' : '';

                const itemHtml = `
                <div class="autocomplete-item">
                    <div class="item-selector${estaEnTabla}" onclick="agregarProductoMultiple('${prod.id}', this)" title="Seleccionar/Quitar">
                        <div class="selector-square"></div>
                    </div>
                    
                    <div class="item-info-clickable" onclick="seleccionarProductoDeLista('${prod.id}')">
                        <div style="display: flex; align-items: center;">
                            <span style="background:#f0f0f0; padding: 2px 6px; border-radius: 4px; font-weight: bold; font-size: 11px; border:1px solid #ddd; color:#555;">${prod.code || 'S/C'}</span>
                            <span style="font-weight: 600; font-size: 13px; color:#333; margin-left:8px;">${prod.name}</span>
                            ${noStockBadge}
                        </div>
                        <div style="font-size: 11px; color: #777; margin-top: 3px;">
                            ${stockHtml}
                        </div>
                    </div>
                </div>`;
                
                $list.append(itemHtml);
            });
        } else { $list.hide(); }
    } catch (e) { console.error(e); $list.hide(); }
}

function agregarProductoMultiple(id, element) {
    const prod = searchResults[id];
    const existingRow = $(`#nc_tablaProductos tr[data-id="${prod.id}"]`);

    if (existingRow.length > 0) {
        eliminarFila(existingRow.attr('id').replace('row_', ''));
        $(element).removeClass('added');
        toastr.info(`Removido: ${prod.name}`);
    } else {
        if (prod) {
            agregarProductoATabla(prod, false);
            $(element).addClass('added');
            toastr.success(`Agregado: ${prod.name}`);
        }
    }
}

function seleccionarProductoDeLista(id) {
    const prod = searchResults[id];
    if (prod) agregarProductoATabla(prod, true);
}

function agregarProductoATabla(prod, cerrarLista = true) {
    if(cerrarLista) { $('#listaProductos').hide(); $('#nc_buscarProducto').val(''); }
    
    if ($(`#nc_tablaProductos tr[data-id="${prod.id}"]`).length > 0) { 
        if(cerrarLista) toastr.error("El producto ya está agregado", "Duplicado"); 
        return; 
    }

    const unidad = prod.unitOfMeasure || 'UNI'; 
    const codigo = prod.code || ''; 
    const nombre = prod.name || 'Producto'; 
    const rowId = Date.now();

    let optionsHtml = '';
    igvListCache.forEach(igv => {
        const selected = (igv.id === prod.igvTypeId) ? 'selected' : '';
        optionsHtml += `<option value="${igv.id}" ${selected}>${igv.description}</option>`;
    });

    // SE ELIMINÓ S/
    const row = `
        <tr id="row_${rowId}" data-id="${prod.id}">
            <td><div style="font-weight:700; color:#333;">${codigo}</div><small style="color:#666; font-size:12px;">${nombre}</small></td>
            <td>${unidad}</td>
            <td><select class="form-control igv-select" style="font-size:12px; padding:5px;" onchange="calcularFila(${rowId})">${optionsHtml}</select></td>
            <td><div class="input-container"><input type="number" class="input-table qty" value="0" min="0.01" step="any" oninput="calcularFila(${rowId})"><span class="row-error-msg">Requerido</span></div></td>
            <td><div class="input-container"><div style="display:flex; align-items:center; width:100%;"><input type="number" class="input-table val" value="0" min="0.01" step="any" oninput="calcularFila(${rowId})"></div><span class="row-error-msg">Requerido</span></div></td>
            <td class="text-right subtotal">0.00</td>
            <td class="text-right igv">0.00</td>
            <td class="text-right total" style="font-weight:bold;">0.00</td>
            <td class="text-center"><button class="btn-delete-row" onclick="eliminarFila(${rowId})"><i class='bx bx-trash'></i></button></td>
        </tr>`;
    $('#nc_tablaProductos').append(row);
    calcularFila(rowId);
}

function calcularFila(rowId) {
    const $row = $(`#row_${rowId}`);
    let qty = parseFloat($row.find('.qty').val());
    let unitVal = parseFloat($row.find('.val').val());
    if (isNaN(qty) || qty < 0) qty = 0;
    if (isNaN(unitVal) || unitVal < 0) unitVal = 0;

    const igvText = $row.find('.igv-select option:selected').text().toLowerCase();
    const subtotal = qty * unitVal;
    let igv = 0;
    if (igvText.includes('gravado')) { igv = subtotal * 0.18; }

    const total = subtotal + igv;
    // SE ELIMINÓ S/
    $row.find('.subtotal').text(`${formatoMoneda(subtotal)}`);
    $row.find('.igv').text(`${formatoMoneda(igv)}`);
    $row.find('.total').text(`${formatoMoneda(total)}`);
    calcularTotalesGlobales();
}

function calcularTotalesGlobales() {
    let globalSubtotal = 0; let globalIGV = 0; let noGravado = 0; let subTotalGravado = 0;
    $('#nc_tablaProductos tr').each(function() {
        const row = $(this);
        const qty = parseFloat(row.find('.qty').val()) || 0;
        const val = parseFloat(row.find('.val').val()) || 0;
        const igvText = row.find('.igv-select option:selected').text().toLowerCase();
        
        const sub = qty * val;
        let igv = 0;
        if (igvText.includes('gravado')) { igv = sub * 0.18; subTotalGravado += sub; } else { noGravado += sub; }
        globalIGV += igv;
    });
    const globalTotal = subTotalGravado + noGravado + globalIGV;
    // SE ELIMINÓ S/
    $('#nc_txtSubTotal').text(`${formatoMoneda(subTotalGravado)}`);
    $('#nc_txtIGV').text(`${formatoMoneda(globalIGV)}`);
    $('#nc_txtNoGravado').text(`${formatoMoneda(noGravado)}`);
    $('#nc_txtTotal').text(`${formatoMoneda(globalTotal)}`);
}

function eliminarFila(rowId) { 
    $(`#row_${rowId}`).remove(); 
    calcularTotalesGlobales(); 
    const prodId = $(`#row_${rowId}`).data('id'); 
}

function guardarCompra() {
    let isValid = true;
    const req = ['nc_almacen', 'nc_tipoDoc', 'nc_fecha', 'nc_moneda'];
    req.forEach(id => { if(!$(`#${id}`).val()) { $(`#${id}`).addClass('error'); $(`#${id}`).siblings('.error-message').addClass('show'); isValid = false; } });

    // DETECTAR SI ES "NO DOMICILIADO"
    const tipoDocText = $('#nc_tipoDoc option:selected').text().toLowerCase();
    const isNoDomiciliado = tipoDocText.includes("no domiciliado");

    // VALIDAR SERIE (Solo si NO es no domiciliado)
    const serie = $('#nc_serie').val().trim();
    if (!isNoDomiciliado) {
        if(serie.length !== 4) { 
            $('#nc_serie').addClass('error'); 
            $('#error_nc_serie').addClass('show'); 
            isValid = false; 
        }
    }

    // VALIDAR NÚMERO (Dinámico)
    const numero = $('#nc_numero').val().trim();
    const maxNumLen = isNoDomiciliado ? 20 : 8;
    if(!numero || numero.length > maxNumLen) { 
        $('#nc_numero').addClass('error'); 
        $('#error_nc_numero').text(`Requerido (Máx ${maxNumLen})`).addClass('show'); 
        isValid = false; 
    }

    if(!$('#nc_idProveedor').val()){ $('#nc_buscarProveedor').addClass('error'); $('#error_nc_proveedor').addClass('show'); isValid = false; }

    if(!isValid) { toastr.error("Corrija los errores en el formulario."); return; }
    if($('#nc_tablaProductos tr').length === 0) { toastr.warning("Agregue al menos un producto."); return; }

    let productError = false;
    const detalles = [];
    $('#nc_tablaProductos tr').each(function() {
        const row = $(this);
        const qtyInput = row.find('.qty');
        const valInput = row.find('.val');
        const qty = parseFloat(qtyInput.val());
        const val = parseFloat(valInput.val());
        
        if (isNaN(qty) || qty <= 0) { qtyInput.addClass('error'); qtyInput.siblings('.row-error-msg').text("Requerido (>0)").show(); productError = true; }
        if (isNaN(val) || val <= 0) { valInput.addClass('error'); valInput.closest('.input-container').find('.row-error-msg').text("Requerido (>0)").show(); productError = true; }

        detalles.push({ productId: row.data('id'), igvTypeId: row.find('.igv-select').val(), quantity: qty, unitValue: val });
    });

    if (productError) { toastr.error("Revise las casillas rojas."); return; }

    const $btn = $('#modalNuevaCompra .btn-save-modal');
    const originalText = $btn.html();
    $btn.prop('disabled', true).html("<i class='bx bx-loader-alt bx-spin'></i> Guardando...");

    // Enviar Serie como null o vacío si está deshabilitada
    const payloadSerie = isNoDomiciliado ? null : serie;

    const nuevaCompra = {
        warehouseId: $('#nc_almacen').val(), voucherTypeId: $('#nc_tipoDoc').val(), currencyId: $('#nc_moneda').val(), personId: $('#nc_idProveedor').val(),
        serie: payloadSerie, number: numero, issueDate: $('#nc_fecha').val(), details: detalles
    };

    // Determinar la URL a usar según el tipo de documento
    let urlToUse = EP_PURCHASE;
    if (isNoDomiciliado) {
        urlToUse = EP_PURCHASE_NON_DOMICILED;
    }

    fetch(urlToUse, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(nuevaCompra) })
    .then(async res => {
        let data = null;
        try { data = await res.json(); } catch(e) {}

        if (res.ok) { 
            toastr.success(data?.message || "Compra registrada correctamente"); 
            cerrarModal('modalNuevaCompra'); 
            fetchCompras(currentPage); 
        } else { 
            let msg = "Error al guardar.";
            if(data?.errors && Array.isArray(data.errors) && data.errors.length > 0) { msg = data.errors[0]; }
            else if (data?.message) { msg = data.message; }
            else if (typeof data === 'string') { msg = data; }
            toastr.error(msg);
            $btn.prop('disabled', false).html(originalText);
        }
    }).catch(err => { 
        toastr.error("Error de conexión con el servidor."); 
        $btn.prop('disabled', false).html(originalText);
    });
}

// 4. SUB-MODAL PRODUCTO
async function abrirModalCrearProducto() { $('#modalCrearProducto').css('display','flex'); cargarDropdown(EP_UNIT,'np_unidad');cargarDropdown(EP_IGV,'np_igv');cargarDropdown(EP_CATEGORY,'np_categoria'); $('#formNuevoProducto')[0].reset(); $('.form-control').removeClass('error'); $('.error-message').removeClass('show'); }
async function guardarNuevoProducto() {
    let v=true; ['np_codigo','np_nombre','np_unidad','np_igv','np_categoria','np_precioVenta'].forEach(i=>{if(!$(`#${i}`).val()){$(`#${i}`).addClass('error');$(`#error_${i}`).addClass('show');v=false;}else{$(`#${i}`).removeClass('error');$(`#error_${i}`).removeClass('show');}});
    if(!v){toastr.error("Complete campos obligatorios.");return;}
    const p={code:$('#np_codigo').val(),name:$('#np_nombre').val(),description:$('#np_descripcion').val(),unitOfMeasureId:$('#np_unidad').val(),igvTypeId:$('#np_igv').val(),categoryId:$('#np_categoria').val(),purchasePrice:parseFloat($('#np_precioCompra').val())||0,salePrice:parseFloat($('#np_precioVenta').val())||0};
    try{const r=await fetch(EP_PRODUCT,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(p)}); if(r.ok){toastr.success("Producto creado.");cerrarModal('modalCrearProducto');}else{const e=await r.json();toastr.error(e.message||"Error al crear.");}}catch{toastr.error("Error conexión.");}
}

// 5. NUEVO SUB-MODAL PROVEEDOR
async function abrirModalCrearProveedor() {
    $('#modalCrearProveedor').css('display', 'flex');
    $('#formNuevoProveedor')[0].reset();
    $('.form-control').removeClass('error');
    $('.error-message').removeClass('show');
    
    try {
        const res = await fetch(EP_DOC_TYPES);
        const data = await res.json();
        const $sel = $('#nprov_tipoDoc'); $sel.empty();
        $sel.append('<option value="">Seleccionar...</option>');
        
        data.forEach(item => {
            const txt = item.description || item.name || item.text;
            const safeTxt = (txt || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
            $sel.append(`<option value="${item.id}" data-name="${safeTxt}">${txt}</option>`);
        });
    } catch(e) { console.error(e); }
}

function validarReglasDocumento() {
    const select = document.getElementById('nprov_tipoDoc');
    const input = document.getElementById('nprov_numeroDoc');
    const errorSpan = document.getElementById('error_nprov_numeroDoc');
    
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
    // Si es Documento tributario, el maxlength 25 del input limita, aquí retornamos true si no está vacío
    return true;
}

async function guardarNuevoProveedor() {
    let isValid = true;
    ['nprov_tipoDoc', 'nprov_numeroDoc', 'nprov_nombre'].forEach(id => {
        if(!$(`#${id}`).val()) { $(`#${id}`).addClass('error'); $(`#error_${id}`).addClass('show'); isValid = false; }
    });

    if(!isValid || !validarReglasDocumento()) {
        toastr.error("Complete el formulario correctamente");
        return;
    }

    const payload = {
        documentTypeId: $('#nprov_tipoDoc').val(),
        documentNumber: $('#nprov_numeroDoc').val().trim(),
        name: $('#nprov_nombre').val().trim(),
        email: $('#nprov_email').val().trim() || null,
        phone: $('#nprov_telefono').val().trim() || null,
        address: $('#nprov_direccion').val().trim() || null
    };

    const $btn = $('#modalCrearProveedor .btn-save-modal');
    $btn.prop('disabled', true).text('Guardando...');

    try {
        const r = await fetch(EP_PERSON, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(payload)
        });

        const d = await r.json();

        if(r.ok) {
            toastr.success("Proveedor registrado exitosamente");
            cerrarModal('modalCrearProveedor');
            const docLabel = $("#nprov_tipoDoc option:selected").text();
            if(d.id) {
                seleccionarProveedor(d.id, payload.name, docLabel, payload.documentNumber);
            } else {
                 buscarPersona(payload.documentNumber); 
            }
        } else {
            if(d.errors) d.errors.forEach(e => toastr.error(e));
            else if(d.message) toastr.error(d.message);
            else toastr.error("Error al guardar proveedor");
        }
    } catch(e) {
        toastr.error("Error de conexión");
        console.error(e);
    } finally {
        $btn.prop('disabled', false).html('Guardar');
    }
}

// ==========================================
// NUEVA LÓGICA: CREAR CATEGORÍA EN EL MODAL
// ==========================================
function abrirModalNuevaCategoria() {
    // Usamos fadeIn (que usa JQuery) porque así se manejan los otros modales en Compras.js
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
// FUNCIÓN CERRAR MODAL (MODIFICADA)
// ==========================================
function cerrarModal(id){
    $(`#${id}`).fadeOut(200);
    
    // LIMPIAR SI ES EL MODAL DE COMPRA
    if (id === 'modalNuevaCompra') {
        limpiarFormularioCompra();
    }
}

async function abrirModalDetalle(purchaseId) {
    if(!purchaseId) return;
    $('#modalDetalle').css('display', 'flex'); $('#modalLoader').show(); $('#modalContentBody').hide();  
    try {
        const res = await fetch(`${EP_PURCHASE}/${purchaseId}`); const item = await res.json();
        
        $('#m_tipoDoc').text(item.voucherType || 'Doc'); 
        let vNum = item.voucherNumber || '-';
        $('#m_serieNumero').text(vNum);
        
        $('#m_fechaEmision').text(formatearFechaPeru(item.issueDate, false));
        $('#m_proveedor').text(item.personName || 'Sin Nombre');
        
        const dNum = item.personDocumentNumber || ''; let dType = item.personDocumentType || (dNum.length===11?'RUC':'DNI');
        $('#m_ruc').text(dNum ? `${dType}: ${dNum}` : '-');
        $('#m_almacen').text(item.warehouse || '-'); $('#m_moneda').text(item.currency || 'Soles');
        
        const fechaReg = item.createdDate || item.auditCreateDate || item.issueDate;
        $('#m_fechaRegistro').text(formatearFechaPeru(fechaReg, true));
        
        const $tb = $('#modalTableBody'); $tb.empty();
        if(item.details){ 
            item.details.forEach(d => {
                const codigoReal = d.productCode || '-'; const nombreProd = d.productName || '-'; const unidad = d.unitOfMeasure || 'Unidad'; const tipoIgv = d.igvType || '-'; 
                const cant = d.quantity !== undefined ? d.quantity : 0; const unitVal = d.unitValue !== undefined ? d.unitValue : 0;
                const sub = d.amount !== undefined ? d.amount : 0;
                const igv = d.taxAmount !== undefined ? d.taxAmount : 0;
                const tot = d.lineTotal !== undefined ? d.lineTotal : 0;

                // SE ELIMINÓ S/
                $tb.append(`<tr>
                    <td><span style="background:#f4f4f4; padding:2px 6px; border-radius:4px; border:1px solid #ddd; font-weight:600;">${codigoReal}</span></td>
                    <td><strong>${nombreProd}</strong></td>
                    <td>${unidad}</td>
                    <td>${tipoIgv}</td>
                    <td class="text-right">${cant.toFixed(2)}</td>
                    <td class="text-right">${formatoMoneda(unitVal)}</td>
                    <td class="text-right">${formatoMoneda(sub)}</td>
                    <td class="text-right">${formatoMoneda(igv)}</td>
                    <td class="text-right"><strong>${formatoMoneda(tot)}</strong></td>
                </tr>`);
            });
        }
        // SE ELIMINÓ S/
        $('#m_totalNoGravado').text(`${formatoMoneda(item.exempt)}`);
        $('#m_totalSubtotal').text(`${formatoMoneda(item.subTotal)}`);
        $('#m_totalIgv').text(`${formatoMoneda(item.taxAmount)}`);
        $('#m_totalFinal').text(`${formatoMoneda(item.total)}`);

        $('#modalLoader').hide(); $('#modalContentBody').fadeIn(200);
    } catch(e){ cerrarModal('modalDetalle'); }
}

// GESTIÓN GLOBAL DE CLICS FUERA DE MODAL
// Evita cerrar los modales de creación si se hace clic en el fondo
$(window).click(function(e) { 
    if ($(e.target).hasClass('modal-overlay')) {
        const id = $(e.target).attr('id');
        // Lista de modales que NO deben cerrarse al hacer clic fuera
        const modalesBloqueados = ['modalNuevaCompra', 'modalCrearProducto', 'modalCrearProveedor', 'modalNuevaCategoria'];
        
        if(modalesBloqueados.includes(id)) {
            return; // No hacer nada, evitar el cierre
        }
        
        // Para otros modales (como el de detalle), sí permitir cerrar
        $(e.target).fadeOut(200); 
    }
});