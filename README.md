# torso-brec

## Client Setup
We want to utilize server side paging in the DataTables widget starting from our BREC table initialization method:

```javascript
  _brecTableInit: function() {
    var view = this;
    var tableEl = this.$el.find('.table-data');
    this.dataTable = $(tableEl).DataTable(_.extend({
      /*
       * HTML in the view does not adhere to Torso standards, however this is required by DataTables to display the  
       * table controls in the desired format.
       * See DataTables documentation: https://datatables.net/reference/option/dom
       */
      'dom': brecDomTemplate(),
      'stateSave': true,
      'serverSide': true,
      'ajax': view._requestData.bind(view),
      'fnStateLoadCallback': function ( settings ) {
        try {
          return JSON.parse(
            (settings.iStateDuration === -1 ? sessionStorage : localStorage).getItem('DataTables_settings_' + location.pathname)
          );
        } catch (e) {
          // Errors here indicate a failure to parse the settings JSON. Since this is a non-critical system, fail silently.
        }
      },
      'fnStateSaveCallback': function ( settings, data ) {
        try {
          (settings.iStateDuration === -1 ? sessionStorage : localStorage).setItem(
            'DataTables_settings_' + location.pathname, JSON.stringify( data )
          );
        } catch (e) {
          // Same as fnStateLoadCallback.
        }
      },
      'columns': view._constructColumns(),
      }, view.brecOptionsOverrides))
  }
```

'dom' calls brecDomTemplate, which is a Handlebars file containing the information for the dom. We have enabled server-side processing, which you can read more about here: https://datatables.net/reference/option/serverSide. Setting serverSide to true enables serverSide processing in the widget. This means that instead of applying the styles, paging, search, etc to an existing table, it will retrieve data from the server and populate the table through the widget. This is effectively bypassing a lot of Torso functionality that we are using. Note that because we are doing this, you should remove any listeners that rerender on collection manipulation for this view, otherwise Torso and the widget will compete to render the view, and you will see a lot of flickering.

fnStateSaveCallback and fnStateLoadCallback handle the local storage of settings in the table. view._constructuColumns is a helper function that contains the information to be used in constructing the columns. view.brecOptionsOverrides is a function that can be overriden in the page view and can extend _brecTableInit with more parameters according to the specific use of the BREC table.

###Dom Element
The 'dom' parameter takes in a string that contains information about where to display the elements of the data table in the view as per DataTables. The string that we pass in is
```
<"top-pagination" p><"filters" <"filter-row" <"showing-filter" li><"search-filter" f> >>rtp
```
More information, including an explanation of the built-in table control elements, can be found here: https://datatables.net/reference/option/dom. 

###Ajax Call
The ajax function we are passing in will be controlling where we get the data, how we make the request, and translating the response into a format that DataTable expects. It will also be in charge of updating the collection that the Torso view is tracking. More about the ajax function can be read at https://datatables.net/reference/option/ajax. _requestData is a helper function that constructs our ajax call.

```javascript
_requestData : function(tableParams, callback) {
    var view = this;
    var collection = this.collection;
    $.ajax({
      url: view.url,
      method: 'POST',
      contentType: 'application/json; charset=utf-8',
      dataType: 'json',
      data: JSON.stringify(tableParams),
      success: function(result) {
        view.trigger('successServerRetrieval');

        collection.fetchByIds(result.list).then(function() {
          callback(view._prepareData(tableParams, result));
          view.trigger('tableUpdateComplete');
        });
      },
      error: function() {
        view.trigger('errorServerRetrieval');

        callback(view._prepareData(tableParams));
        view.trigger('tableUpdateComplete');
      }
    });
  }
```

The url is a parameter in our page view, and we use POST to retrieve the information. In the event of a successful server retrieval, we perform the success function. We first trigger an event that broadcasts the successful retrieval. Then we retrieve the correct data from our collection, prepare the data in a helper function, and trigger tableUpdateComplete, a function that makes updates to the table without having to reinitialize the widget. In the event of an error, we trigger an event that broadcasts that error, prepare the data that will allow us to correctly format an empty table, and trigger tableUpdateComplete.

#####Data Manipulation
view._prepareData is a function that prepares the final representation of the data as required by DataTables. It takes in tableParams, which are parameters for the ajax request to retrieve the desired data, and result, which is the result of the server retrieval (in the case of an error, result will be null).

```javascript
_prepareData : function(tableParams, result) {
    var translatedData = [];
    var totalRecords = 0;

    if (result) {
      translatedData = this._translateData(result.list);
      totalRecords = result.fullListSize;
    }

    return {
      'data': translatedData,
      'recordsTotal': totalRecords,
      'recordsFiltered': totalRecords,
      'draw': parseInt(tableParams.draw)
    };
  },
```

This method allows us to process the data correctly in the case of a succesfful server retrieval or an error. If the server call was successful and result contains information, then we use _translateData to translate the collection of objects that Torso retrieves into a format that DataTables expects. idListOrder is an array with the ids of the objects to add in the desired order. 

```javascript
_translateData: function(idListOrder) {
    var view = this;
    var columnInfo = this.columnInit();
    return _.compact(idListOrder.map(function(modelId) {
      var model = view.collection.get(modelId);

      // DataTables can not handle empty or null objects in the array list.
      // Therefore, we should default to returning null if model does not exist and then filter those values out with compact.
      var modelAsArray = null;
      if (model) {
        // The ordering here is very important as it determines the ordering of cells in each table row.
        // Table cells will be placed from left to right in the same order as the attributes listed here.
        modelAsArray = [];
        for (var i=0; i<columnInfo.length; i++) {
          // Utilize handlebars helpers to escape the html
          modelAsArray.push(Handlebars.Utils.escapeExpression(model.get(columnInfo[i][0])));
        }
      }
      return modelAsArray;
    }));
  }
```
