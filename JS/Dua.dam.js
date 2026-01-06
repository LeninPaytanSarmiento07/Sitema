// ==========================================
// CONFIGURACIÓN INICIAL
// ==========================================
const API_BASE = "https://posapi2025new-augrc0eshqgfgrcf.canadacentral-01.azurewebsites.net/api";

const EP_WAREHOUSE = `${API_BASE}/Warehouse/select`;
const EP_CURRENCY = `${API_BASE}/Currency/select`;
const EP_PERSON_SEARCH = `${API_BASE}/Person/search`;
const EP_PURCHASE_NODOM = `${API_BASE}/Purchase/non-domiciled-for-dua`;
const EP_DUA_CREATE = `${API_BASE}/Dua`;

let availablePurchases = []; // Almacena datos crudos de la API
let selectedPurchases = [];  // Almacena las compras seleccionadas (objetos completos)

// Configuración Toastr
toastr.options = { "closeButton": true, "positionClass": "toast-bottom-right", "timeOut": "5000", "preventDuplicates": false };

$(document).ready(function() {
    initPage();

    // Listeners
    $('#dua_almacen').on('change', function() {
        const whId = $(this).val();
        cargarComprasNoDomiciliadas(whId);
    });

    $('#dua_buscarProveedor').on('input', function() {
        buscarProveedor($(this).val());
    });

    // Inputs de cálculo
    $('.input-calc').on('input', calcularValoresDua);

    // Guardar
    $('#btnGuardarDua').on('click', guardarDua);

    // Fechas por defecto
    const today = new Date().toISOString().split('T')[0];
    $('#dua_fechaEmision').val(today);
    $('#dua_fechaPago').val(today);
});

async function initPage() {
    await cargarSelect(EP_WAREHOUSE, 'dua_almacen');
    await cargarSelect(EP_CURRENCY, 'dua_moneda');
    
    // Cargar compras del primer almacén si existe
    const firstWh = $('#dua_almacen').val();
    if(firstWh) cargarComprasNoDomiciliadas(firstWh);
}

async function cargarSelect(url, elementId) {
    try {
        const r = await fetch(url);
        const d = await r.json();
        const $el = $(`#${elementId}`);
        $el.empty();
        d.forEach(i => {
            $el.append(`<option value="${i.id}">${i.description || i.name || i.symbol}</option>`);
        });
    } catch(e) { console.error(e); }
}

// ---------------------------------------------------
// 1. CARGA DE COMPRAS NO DOMICILIADAS (CON ACORDEÓN Y ALINEACIÓN)
// ---------------------------------------------------
async function cargarComprasNoDomiciliadas(warehouseId) {
    const $container = $('#containerCompras');
    const $loader = $('#loadingCompras');
    
    if(!warehouseId) {
        $container.html('<div style="padding:20px; text-align:center; color:#888;">Seleccione un almacén.</div>');
        return;
    }

    $loader.show();
    $container.empty();
    availablePurchases = [];
    selectedPurchases = [];
    actualizarResumenSeleccion();
    limpiarCalculos();

    try {
        const r = await fetch(`${EP_PURCHASE_NODOM}?warehouseId=${warehouseId}`);
        if(!r.ok) throw new Error("Error al cargar compras");
        const data = await r.json();
        availablePurchases = data;

        if(data.length === 0) {
            $container.html('<div style="padding:20px; text-align:center; color:#888;">No hay compras no domiciliadas pendientes.</div>');
        } else {
            data.forEach(compra => {
                // Datos cabecera
                const fecha = compra.issueDate ? new Date(compra.issueDate).toLocaleDateString() : 'S/F';
                const totalFmt = compra.total.toLocaleString('en-US', {minimumFractionDigits:2});
                const serieNumero = compra.voucherNumber || 'S/N';
                const proveedor = compra.personName || 'Sin Nombre';

                // Generar HTML de Productos (Tabla Interna Alineada)
                let tableRowsHtml = '';
                const itemsCount = compra.details ? compra.details.length : 0;
                
                if(compra.details && itemsCount > 0) {
                    compra.details.forEach(det => {
                        const precioUnit = det.unitValue || 0;
                        tableRowsHtml += `
                            <tr>
                                <td><b>${det.productCode}</b> - ${det.productName}</td>
                                <td class="text-right">${det.unitOfMeasure}</td>
                                <td class="text-right">${det.quantity}</td>
                                <td class="text-right">$ ${precioUnit.toFixed(2)}</td>
                            </tr>
                        `;
                    });
                } else {
                    tableRowsHtml = '<tr><td colspan="4" style="text-align:center; color:#999;">Sin detalles</td></tr>';
                }

                // Estructura HTML
                const itemHtml = `
                    <div class="compra-wrapper">
                        <div class="compra-header-row">
                            <input type="checkbox" class="compra-checkbox" data-id="${compra.id}" onchange="toggleSeleccion('${compra.id}')">
                            
                            <button class="btn-expand" id="btn-exp-${compra.id}" onclick="toggleDetalleCompra('${compra.id}')">
                                <i class='bx bx-chevron-right'></i>
                            </button>
                            
                            <div class="compra-info-text">
                                <div class="info-segment" style="width: 150px;">
                                    <span class="info-val">${serieNumero}</span>
                                </div>
                                <span class="separator">|</span>
                                <div class="info-segment" style="flex: 1;">
                                    <span class="info-val">${proveedor}</span>
                                </div>
                                <span class="separator">|</span>
                                <div class="info-segment" style="width: 100px;">
                                    <span class="info-val">${fecha}</span>
                                </div>
                                <span class="separator">|</span>
                                <div class="info-segment">
                                    <span class="total-highlight">$ ${totalFmt}</span>
                                </div>
                            </div>
                        </div>

                        <div id="details-${compra.id}" class="compra-details-box">
                            <div class="details-title">
                                <i class='bx bx-list-ul'></i> Lista de Productos (${itemsCount}):
                            </div>
                            
                            <table class="mini-prod-table">
                                <thead>
                                    <tr>
                                        <th>Producto</th>
                                        <th class="text-right w-unit">Unidad</th>
                                        <th class="text-right w-qty">Cant.</th>
                                        <th class="text-right w-val">V. Unit.</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${tableRowsHtml}
                                </tbody>
                            </table>
                        </div>
                    </div>
                `;
                $container.append(itemHtml);
            });
        }
    } catch(e) {
        console.error(e);
        $container.html('<div style="color:#d32f2f; padding:20px; text-align:center;">Error de conexión.</div>');
    } finally {
        $loader.hide();
    }
}

// ---------------------------------------------------
// FUNCIÓN PARA DESPLEGAR DETALLES
// ---------------------------------------------------
window.toggleDetalleCompra = function(id) {
    const detailBox = $(`#details-${id}`);
    const btn = $(`#btn-exp-${id}`);
    
    // Alternar visibilidad (Slide)
    detailBox.slideToggle(200);
    
    // Alternar clase para rotar icono
    btn.toggleClass('active');
};

// ---------------------------------------------------
// 2. LÓGICA DE SELECCIÓN Y CÁLCULOS
// ---------------------------------------------------
window.toggleSeleccion = function(id) {
    const compra = availablePurchases.find(c => c.id === id);
    if(!compra) return;

    const idx = selectedPurchases.findIndex(c => c.id === id);
    if(idx === -1) {
        selectedPurchases.push(compra);
    } else {
        selectedPurchases.splice(idx, 1);
    }

    actualizarResumenSeleccion();
    autoLlenarFOB();
    calcularValoresDua();
};

function actualizarResumenSeleccion() {
    const count = selectedPurchases.length;
    const total = selectedPurchases.reduce((sum, c) => sum + c.total, 0);
    
    $('#lblCountSel').text(count);
    $('#lblTotalSel').text('$ ' + total.toLocaleString('en-US', {minimumFractionDigits:2}));
}

function autoLlenarFOB() {
    const total = selectedPurchases.reduce((sum, c) => sum + c.total, 0);
    $('#val_fob').val(total.toFixed(2));
}

function calcularValoresDua() {
    const fob = parseFloat($('#val_fob').val()) || 0;
    const flete = parseFloat($('#val_flete').val()) || 0;
    const seguro = parseFloat($('#val_seguro').val()) || 0;
    const adValorem = parseFloat($('#val_advalorem').val()) || 0;
    const tasaPerc = parseFloat($('#val_tasa_percepcion').val()) || 0;

    const cif = fob + flete + seguro;
    const ipm = (cif + adValorem) * 0.02;
    const igv = (cif + adValorem) * 0.16;
    
    const totalTributos = adValorem + ipm + igv;
    const totalGlobal = cif + totalTributos; 

    $('#res_cif').text(cif.toFixed(2));
    $('#res_ipm').text(ipm.toFixed(2));
    $('#res_igv').text(igv.toFixed(2));
    $('#res_total').text(totalGlobal.toFixed(2));

    calcularDistribucion(fob, flete, seguro, adValorem, ipm, igv);
}

function calcularDistribucion(totalFob, flete, seguro, adval, ipm, igv) {
    const $tbody = $('#bodyDistribucion');
    $tbody.empty();

    if(selectedPurchases.length === 0 || totalFob <= 0) {
        $tbody.html('<tr><td colspan="5" class="text-center" style="padding:15px; color:#999;">Seleccione compras y asegure FOB > 0</td></tr>');
        return;
    }

    const totalGastos = flete + seguro + adval + ipm + igv;

    selectedPurchases.forEach(compra => {
        if(compra.details) {
            compra.details.forEach(det => {
                const unitVal = det.unitValue || 0;
                const lineTotal = det.quantity * unitVal;
                
                let proportion = 0;
                if(totalFob > 0) proportion = (lineTotal / totalFob);
                
                const distValue = totalGastos * proportion;
                const propPercent = (proportion * 100).toFixed(2);

                // FILA ALINEADA
                $tbody.append(`
                    <tr>
                        <td><small style="color:#888;">${det.productCode}</small><br><b>${det.productName}</b></td>
                        <td class="text-right">${det.quantity.toFixed(2)}</td>
                        <td class="text-right">${lineTotal.toFixed(2)}</td>
                        <td class="text-right">${propPercent} %</td>
                        <td class="text-right"><b>${distValue.toFixed(2)}</b></td>
                    </tr>
                `);
            });
        }
    });
}

function limpiarCalculos() {
    $('#val_fob').val('');
    $('#val_flete').val('');
    $('#val_seguro').val('');
    $('#val_advalorem').val('');
    $('#res_cif').text('0.00');
    $('#res_ipm').text('0.00');
    $('#res_igv').text('0.00');
    $('#res_total').text('0.00');
    $('#bodyDistribucion').empty();
}

// ---------------------------------------------------
// 3. AUTOCOMPLETE PROVEEDOR
// ---------------------------------------------------
async function buscarProveedor(term) {
    const $list = $('#listaProveedores');
    if(term.length < 2) { $list.hide(); return; }

    try {
        const r = await fetch(`${EP_PERSON_SEARCH}?searchTerm=${term}`);
        const data = await r.json();
        const items = data.items || data;
        
        $list.empty();
        if(items.length > 0) {
            $list.show();
            items.forEach(p => {
                $list.append(`
                    <div class="autocomplete-item" onclick="seleccionarProveedor('${p.id}', '${p.name}')">
                        <b>${p.name}</b><br><small style="color:#888;">${p.documentNumber}</small>
                    </div>
                `);
            });
        } else {
            $list.hide();
        }
    } catch(e) { console.error(e); }
}

window.seleccionarProveedor = function(id, name) {
    $('#dua_idProveedor').val(id);
    $('#dua_buscarProveedor').val(name);
    $('#listaProveedores').hide();
};

$(document).click(function(e) { 
    if(!$(e.target).closest('.autocomplete-wrapper').length) {
        $('#listaProveedores').hide(); 
    } 
});

// ---------------------------------------------------
// 4. GUARDAR
// ---------------------------------------------------
async function guardarDua() {
    const whId = $('#dua_almacen').val();
    const currId = $('#dua_moneda').val();
    const persId = $('#dua_idProveedor').val();
    const serie = $('#dua_serie').val();
    const numero = $('#dua_numero').val();
    const year = $('#dua_year').val();
    
    if(!whId || !currId || !persId || !serie || !numero || !year) {
        toastr.error("Complete los campos obligatorios.");
        return;
    }

    if(selectedPurchases.length === 0) {
        toastr.error("Debe seleccionar al menos una compra.");
        return;
    }

    const ids = selectedPurchases.map(c => c.id);

    const payload = {
        warehouseId: whId,
        currencyId: currId,
        personId: persId,
        serie: serie,
        duaYear: year,
        number: numero,
        issueDate: $('#dua_fechaEmision').val(),
        paymentDate: $('#dua_fechaPago').val(),
        perceptionRate: $('#val_tasa_percepcion').val() || "0",
        fobValue: ($('#val_fob').val() || 0).toString(),
        freightValue: ($('#val_flete').val() || 0).toString(),
        insuranceValue: ($('#val_seguro').val() || 0).toString(),
        adValoremValue: ($('#val_advalorem').val() || 0).toString(),
        relatedPurchaseIds: ids
    };

    const $btn = $('#btnGuardarDua');
    $btn.prop('disabled', true).text('Guardando...');

    try {
        const response = await fetch(EP_DUA_CREATE, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if(response.ok) {
            toastr.success(data.message || "DUA registrada correctamente");
            setTimeout(() => {
                window.location.href = 'Compras.html';
            }, 1500);
        } else {
            if(data.errors) data.errors.forEach(e => toastr.error(e));
            else toastr.error(data.message || "Error al registrar DUA");
            $btn.prop('disabled', false).html("<i class='bx bx-save'></i> Registrar DUA");
        }
    } catch(e) {
        console.error(e);
        toastr.error("Error de conexión");
        $btn.prop('disabled', false).html("<i class='bx bx-save'></i> Registrar DUA");
    }
}