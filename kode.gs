// =========================================================================
// 1. CONFIGURASI & AUTO-GENERATE SHEET FORESA LAUNDRY
// =========================================================================

function inisialisasiDatabase() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var strukturDatabase = {
    // UPDATE: Tambah kolom "estimatedPickup" dan "itemsDetail" di ujung tabel
    "Transaksi": ["id", "customer", "phone", "service", "total", "cashier", "method", "status", "paymentStatus", "date", "estimatedPickup", "itemsDetail"],
    "Menu": ["id", "name", "price", "type"],
    "Pengeluaran": ["id", "tanggal", "keterangan", "nominal", "sumber_dana"]
  };

  for (var namaSheet in strukturDatabase) {
    var sheet = ss.getSheetByName(namaSheet);
    if (!sheet) {
      sheet = ss.insertSheet(namaSheet);
      sheet.getRange(1, 1, 1, strukturDatabase[namaSheet].length).setValues([strukturDatabase[namaSheet]]);
      sheet.getRange(1, 1, 1, strukturDatabase[namaSheet].length).setFontWeight("bold");
    }
  }
}

// =========================================================================
// 2. ENDPOINT GET: Membaca Data
// =========================================================================
function doGet(e) {
  inisialisasiDatabase();
  var action = e.parameter.action;
  var orderParam = e.parameter.order;
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  if (orderParam) {
    var sheetTransaksi = ss.getSheetByName("Transaksi");
    var dataTransaksi = sheetTransaksi.getDataRange().getValues();
    var foundOrder = null;
    
    for (var j = 1; j < dataTransaksi.length; j++) {
      if (String(dataTransaksi[j][0]).trim().toUpperCase() === String(orderParam).trim().toUpperCase()) {
        foundOrder = {
          id: String(dataTransaksi[j][0]), 
          customer: String(dataTransaksi[j][1]), 
          phone: String(dataTransaksi[j][2]),
          service: String(dataTransaksi[j][3]), 
          total: Number(dataTransaksi[j][4]), 
          cashier: String(dataTransaksi[j][5]),
          method: String(dataTransaksi[j][6]), 
          status: String(dataTransaksi[j][7]), 
          paymentStatus: String(dataTransaksi[j][8]),
          date: String(dataTransaksi[j][9]),
          estimatedPickup: String(dataTransaksi[j][10]), //   UPDATE BACA DATA
          itemsDetail: String(dataTransaksi[j][11])      //   UPDATE BACA DATA
        };
        break;
      }
    }
    
    if (foundOrder) {
      return ContentService.createTextOutput(JSON.stringify({ transactions: [foundOrder] })).setMimeType(ContentService.MimeType.JSON);
    } else {
      return ContentService.createTextOutput(JSON.stringify({ transactions: [] })).setMimeType(ContentService.MimeType.JSON);
    }
  }

  if (action === "read") {
    var responseData = { customServices: [], transactions: [], expenses: [] };
    
    // Baca Menu
    var sheetMenu = ss.getSheetByName("Menu");
    var dataMenu = sheetMenu.getDataRange().getValues();
    for (var i = 1; i < dataMenu.length; i++) {
      if (dataMenu[i][0] === "") continue;
      responseData.customServices.push({ id: String(dataMenu[i][0]), name: String(dataMenu[i][1]), price: Number(dataMenu[i][2]), type: String(dataMenu[i][3]) });
    }
    
    // Baca Transaksi
    var sheetTransaksi = ss.getSheetByName("Transaksi");
    var dataTransaksi = sheetTransaksi.getDataRange().getValues();
    for (var j = 1; j < dataTransaksi.length; j++) {
      if (dataTransaksi[j][0] === "") continue;
      responseData.transactions.push({
        id: String(dataTransaksi[j][0]), 
        customer: String(dataTransaksi[j][1]), 
        phone: String(dataTransaksi[j][2]),
        service: String(dataTransaksi[j][3]), 
        total: Number(dataTransaksi[j][4]), 
        cashier: String(dataTransaksi[j][5]),
        method: String(dataTransaksi[j][6]), 
        status: String(dataTransaksi[j][7]), 
        paymentStatus: String(dataTransaksi[j][8]),
        date: String(dataTransaksi[j][9]),
        estimatedPickup: String(dataTransaksi[j][10]), //   UPDATE BACA DATA
        itemsDetail: String(dataTransaksi[j][11])      //   UPDATE BACA DATA
      });
    }

    // Baca Pengeluaran
    var sheetPengeluaran = ss.getSheetByName("Pengeluaran");
    if(sheetPengeluaran) {
      var dataPengeluaran = sheetPengeluaran.getDataRange().getValues();
      for (var k = 1; k < dataPengeluaran.length; k++) {
        if (dataPengeluaran[k][0] === "") continue;
        responseData.expenses.push({
          id: String(dataPengeluaran[k][0]), tanggal: String(dataPengeluaran[k][1]),
          keterangan: String(dataPengeluaran[k][2]), nominal: Number(dataPengeluaran[k][3]),
          sumber_dana: String(dataPengeluaran[k][4])
        });
      }
    }

    return ContentService.createTextOutput(JSON.stringify(responseData)).setMimeType(ContentService.MimeType.JSON);
  }
  return ContentService.createTextOutput(JSON.stringify({error: "Aksi GET tidak valid"})).setMimeType(ContentService.MimeType.JSON);
}

// =========================================================================
// 3. ENDPOINT POST: Menyimpan / Memperbarui Data
// =========================================================================
function doPost(e) {
  inisialisasiDatabase();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var params = JSON.parse(e.postData.contents);
  var action = params.action;
  
  if (!action && params.id) {
    var sheetTransaksi = ss.getSheetByName("Transaksi");
    //   UPDATE: Tambahkan params.estimatedPickup dan params.itemsDetail saat input data baru ke tabel
    sheetTransaksi.appendRow([ params.id, params.customer, params.phone, params.service, params.total, params.cashier, params.method, params.status, params.paymentStatus, params.date, params.estimatedPickup, params.itemsDetail ]);
    return ContentService.createTextOutput(JSON.stringify({status: "success"})).setMimeType(ContentService.MimeType.JSON);
  }

  if (action === "addExpense") {
    var sheetPengeluaran = ss.getSheetByName("Pengeluaran");
    sheetPengeluaran.appendRow([params.id, params.tanggal, params.keterangan, params.nominal, params.sumber_dana]);
    return ContentService.createTextOutput(JSON.stringify({status: "success"})).setMimeType(ContentService.MimeType.JSON);
  }
  
  if (action === "addService") {
    var sheetMenu = ss.getSheetByName("Menu");
    sheetMenu.appendRow([params.id, params.name, params.price, params.type]);
    return ContentService.createTextOutput(JSON.stringify({status: "success"})).setMimeType(ContentService.MimeType.JSON);
  }
  
  if (action === "editService") {
    var sheetMenu = ss.getSheetByName("Menu");
    var dataMenu = sheetMenu.getDataRange().getValues();
    for (var i = 1; i < dataMenu.length; i++) {
      if (dataMenu[i][0] == params.id) {
        sheetMenu.getRange(i + 1, 2).setValue(params.name);
        sheetMenu.getRange(i + 1, 3).setValue(params.price); 
        sheetMenu.getRange(i + 1, 4).setValue(params.type);
        break;
      }
    }
    return ContentService.createTextOutput(JSON.stringify({status: "success"})).setMimeType(ContentService.MimeType.JSON);
  }
  
  if (action === "deleteService") {
    var sheetMenu = ss.getSheetByName("Menu");
    var dataMenu = sheetMenu.getDataRange().getValues();
    for (var i = 1; i < dataMenu.length; i++) {
      if (dataMenu[i][0] == params.id) {
        sheetMenu.deleteRow(i + 1);
        break;
      }
    }
    return ContentService.createTextOutput(JSON.stringify({status: "success"})).setMimeType(ContentService.MimeType.JSON);
  }
  
  if (action === "updateStatus") {
    var sheetTransaksi = ss.getSheetByName("Transaksi");
    var dataTransaksi = sheetTransaksi.getDataRange().getValues();
    for (var j = 1; j < dataTransaksi.length; j++) {
      if (dataTransaksi[j][0] == params.id) {
        sheetTransaksi.getRange(j + 1, 8).setValue(params.status);
        break;
      }
    }
    return ContentService.createTextOutput(JSON.stringify({status: "success"})).setMimeType(ContentService.MimeType.JSON);
  }
  
  if (action === "updatePaymentStatus") {
    var sheetTransaksi = ss.getSheetByName("Transaksi");
    var dataTransaksi = sheetTransaksi.getDataRange().getValues();
    for (var j = 1; j < dataTransaksi.length; j++) {
      if (dataTransaksi[j][0] == params.id) {
        sheetTransaksi.getRange(j + 1, 9).setValue(params.paymentStatus);
        break;
      }
    }
    return ContentService.createTextOutput(JSON.stringify({status: "success"})).setMimeType(ContentService.MimeType.JSON);
  }
  
  return ContentService.createTextOutput(JSON.stringify({status: "failed", message: "Aksi POST tidak dikenal"})).setMimeType(ContentService.MimeType.JSON);
}
