/**
* Shows the HTML form in a dialog shape.
*/
function openInvoiceWaybillDialog() {
  var html = HtmlService.createTemplateFromFile('invoice_waybill')
  .evaluate().setSandboxMode(HtmlService.SandboxMode.IFRAME).setHeight(1000).setWidth(1600)
  .setTitle('Dialog');
  SpreadsheetApp.getUi().showModalDialog(html, 'Nueva Boleta, Factura o Guía de Devolución');
}

/**
* Gets the products of a waybill, based on its id.
*/
function getProductsStore(selectedStoreName) {
  
    // get the data in the active sheet 
    var sheet = getOutputSheet(1); 
  
    var cell = getOutputFirstCell(1);
  
    cell.setFormula("=QUERY('Base de Datos'!A:M;\"select F, G, H, K, sum(I), max(L) where J='No Vendido' and K='"+selectedStoreName+"' group by G, F, H, K\")");
  
	// create a 2 dim area of the data in the carrier names column and codes 
	var products = sheet.getRange(2, 1, sheet.getLastRow() -1, 6).getValues().reduce( 
		function(p, c) { 
          
          // add the product to the list
			p.push(c); 
			return p; 
		}, []); 
  
    return JSON.stringify(products);
}


function invoiceWaybill(bill) {
   
  //sort the table preparing to do the multiple searches in order to update the inventory
  SpreadsheetApp.getActive().getSheetByName("Productos").sort(1, true);
  
  var productSheet = MemsheetApp.getSheet("Productos");
  var productIdColumn = productSheet.getColumn(1);
  var sheet = MemsheetApp.getSheet("Base de Datos");
  var cloneRows = [];
  
  var waybillIds = [];
  
  // Iterate each waybill product and set its attributes in each column.
  for (var i=0; i<bill.length; i++) {
   
    var product = bill[i];
    waybillIds[i] = changeStoreProductInventory(product, sheet, productIdColumn, cloneRows);
  }
  
  //update the tables
  MemsheetApp.flush();
  
  //add the cloned rows with less waybill stock at the end of the sheet.
  if (cloneRows.length > 0) {
    sheet = SpreadsheetApp.getActive().getSheetByName("Base de Datos");
    var lastRow = sheet.getLastRow();
    sheet.getRange(lastRow+1, 1, cloneRows.length, cloneRows[0].length).setValues(cloneRows);
  }                           
  
  return waybillIds;
}
  
function changeStoreProductInventory(product, sheet, productIdColumn, cloneRows) {
  
  var amount = parseInt(product.amount);
  var price = parseInt(product.price);
  var total = parseInt(product.total);
  var store = product.store;
  var waybillIds = [];
  var j = 0;
  
  var length = sheet.rows.length;
  console.log(length);
  
  // iterate each row
  for (var i = 0; i < sheet.rows.length; i++) {
    
    var sheetStore = sheet.getCell(i+1,11).getValue();
    var sheetProductId = sheet.getCell(i+1,6).getValue();
    var sheetProductStatus = sheet.getCell(i+1,10).getValue();
    
    // check if it is a product-store-notselled row
    if (sheetStore == store && sheetProductId == product.id && sheetProductStatus == "No Vendido") {
      
      // get the waybillId
      var waybillId = sheet.getCell(i+1,1).getValue();
      var waybillInventory = parseInt(sheet.getCell(i+1,9).getValue());
      
      waybillIds[j] = waybillId;
      j++;
      
      //if the amount invoiced is less than the store inventory, we create a new row with the invoice and 
      if (amount < waybillInventory) {
        
        //clone the waybill products in the new row with modified amount
        var cloneRow = [];
        
        for (var k = 0; k < sheet.rows[i].length; k++) {
          
          cloneRow.push(sheet.rows[i][k]);
        }
        
        cloneRow[8] = waybillInventory - amount;
        cloneRows.push(cloneRow);
        
        //set the invoiced products in the actual row with the new amount
        sheet.getCell(i+1,9).setValue(amount);
        sheet.getCell(i+1,12).setValue(price);
        sheet.getCell(i+1,13).setValue(total);
        setInvoiceWaybillProduct(sheet, product, i+1);
        
        // if it's a chargeback, increase the inventory        
        if (product.billType == "chargeback") {
         
          increaseProductStock(product.id, amount, productIdColumn); 
          
        }
        
        break;
        
      } else if (amount == waybillInventory) {
         
        //set the sold products
        setInvoiceWaybillProduct(sheet, product, i+1);
        
        //set the new price
        sheet.getCell(i+1,12).setValue(price);
        sheet.getCell(i+1,13).setValue(total);
        
        // if it's a chargeback, increase the inventory        
        if (product.billType == "chargeback") {
         
          increaseProductStock(product.id, amount, productIdColumn); 
          
        }
        
        break;
       
      } else {
       
        //set the sold products
        setInvoiceWaybillProduct(sheet, product, i+1);
        
        // if it's a chargeback, increase the inventory        
        if (product.billType == "chargeback") {
         
          increaseProductStock(product.id, waybillInventory, productIdColumn); 
          
        }
        
        // reduce the amount in
        amount = amount - waybillInventory;
      }
    }
    
  } 

  return waybillIds;
}

      function setInvoiceWaybillProduct(sheet, product, row) {
       
     //get the bill type and bill status  
      var billType = getSpanishBillType(product.billType);
      var status = getSpanishStatus(product.billType);
        
      sheet.getCell(row,3).setValue(billType);
      sheet.getCell(row,4).setValue(product.billId);
      sheet.getCell(row,5).setValue(product.billDate);
      sheet.getCell(row,10).setValue(status);
      
      if (product.billType == "chargeback") {
       
        sheet.getCell(row,14).setValue(product.chargeback);
      }
      
      
  }
  
  function getSpanishBillType(billType) {
   
    if (billType == "receipt") {
      return "Boleta";
    } else if (billType == "invoice") {
      return "Factura";
      
    } else if (billType == "chargeback") {
      return "Guía de Devolución";
    }  
  }
  
  function getSpanishStatus(billType) {
   
    if (billType == "receipt" || billType == "invoice") {
      return "Vendido";
   
    } else if (billType == "chargeback") {
      return "Devuelto";
    }  
  }

