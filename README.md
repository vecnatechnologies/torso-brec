# torso-brec

## About
This project uses [backbone-torso](https://github.com/vecnatechnologies/backbone-torso) (a backbone-based framework) and [BREC](https://github.com/vecnatechnologies/brec-base) (beautiful, responsive, ergonomic, and configurable) styling and plugins. It contains a view to handle BREC tables that uses [DataTables](https://datatables.net/) to create a highly configurable table with server-side processing.

## How to use

The BREC table view has most of the necessary information and functions to create a functioning BREC table. By extending that view, we can easily create our page view with any additional functionality we want.

Note that we always need to set the url property for the POST server retrieval:

```javascript
url: Urls.faqEntryService + '/paged/dt'
```

#### Extensions
There are a few options that we can extend the default functionality for. They include
- tableOptionsExtensions - extends brecTableInit in the BREC table view. Possible options can be found at https://datatables.net/reference/option/#Options.
- colVisExtensions - extends the colVis DataTables extension to show and hide columns. More information is at https://datatables.net/extensions/colvis/.
- colReorderExtensions - extends the colReorder DataTables extension that allows columns to be reordered. More information is at https://datatables.net/extensions/colreorder/.
- responsiveTable - Because of how the responsive table option works, a table can be either responsive OR have ColVis enabled and be able to show and hide columns. If this boolean is true, then the table is responsive. If the boolean is false, then the table cannot be responsive, but columns can be shown and hidden.

For instance, the code below extends each of these options for a table where the first and last columns are buttons and cannot be ordered, hidden, or moved.

```javascript
url: Urls.faqEntryService + '/paged/dt',
tableOptionsExtensions : {
  // Override default sorting from column 0 (which we want to be unsortable) to column 2 (question).
  'order': [2, 'asc']
},
colVisExtensions: {
  // Exclude the select and edit columns from the colvis menu so that they cannot be hidden.
  exclude: [0,5]
},
colReorderExtensions: {
  // Fix the select and edit columns in place so they cannot be reordered.
  'fixedColumnsRight': 1,
  'fixedColumns': 1
},
responsiveTable: false // The table will not be responsive so we can show/hide columns
```

#### Overrides
#####Initialization
We need to override the default initialize method in the BREC table view. Currently, creating a BREC table requires the information to be in a collection, so initialize should be similar to:

```javascript
initialize: function() {
  this.collection = faqEntryCacheCollection.createPrivateCollection(this.cid);
  BrecTableView.prototype.initialize.call(this);
},
```

##### Column Initialization
In order for the table to format the columns correctly, we need to override the columnInit function. columnInit returns a list that contains objects, where each object corresponds to one of the columns in the table. It should look something like:

```javascript
columnInit: function() {
  return [
    this._buildColumnConfig('id', {
      'name': '',
      'data': 'id',
      'render': function (data, type) {
        if (type === 'display') {
          return faqSelectCheckboxTemplate({itemId: data});
        }
        return data;
      }
    }),
    this._buildColumnConfig('category'),
    this._buildColumnConfig('question'),
    this._buildColumnConfig('answer'),
    this._buildColumnConfig('show'),
    this._buildColumnConfig('id', {
      'name': '',
      'data': 'id',
      'render': function (data) {
        return faqEditButtonTemplate({itemId: data});
      }
    }),
  ];
},
```

_buildColumnConfig is a helper function that formats the column information in the way that DataTables expects. It can build a column based on two distinct templates. For a basic column without special formatting, the function only needs the name/ID of the column, which will be used to translate the entries in the collection with corresponding IDs.

If the column requires special formatting, such as checkboxes or buttons, then it requires both the ID and an object that contains its 'name' field, 'data' field, and any other parameters, such as 'render'. It is very important that these columns have both the 'name' and 'data' field, or column reordering will not function.

In this example we can see there are 6 columns - the first and last one are specially formatted, and the middle four are general columns. Note that the ordering of these lists are very important, since it will determine the ordering of cells in each table row.

##### Success/Error Server Retrieval
If we want something to happen on a successful server retrieval or an error during the server retrieval, we can override the successfulServerRetrieval and errorServerRetrieval functions. Their default functionality is to do nothing.

#### Other functions
Additional functions can be added after the necessary overrides, such as functions that allow entries to be added, deleted, or edited. If the table needs to be updated after adding, deleting, or editing a row, call this.dataTable.ajax.reload() to update the table (more information at https://datatables.net/reference/api/ajax.reload).

## Credits
Originally developed by [Vecna Technologies, Inc.](http://www.vecna.com/) and open sourced as part of its community service program. See the LICENSE file for more details.
Vecna Technologies encourages employees to give 10% of their paid working time to community service projects.
To learn more about Vecna Technologies, its products and community service programs, please visit http://www.vecna.com.
