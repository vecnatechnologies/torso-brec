# torso-brec

## About
This project uses [backbone-torso](https://github.com/vecnatechnologies/backbone-torso) (a backbone-based framework) and [BREC](https://github.com/vecnatechnologies/brec-base) (beautiful, responsive, ergonomic, and configurable) styling and plugins. It contains a view to handle BREC tables that use [DataTables](https://datatables.net/) to create a highly configurable table with server-side processing.

## How to use
To use this view, you will have to extend it with a URL where the data is located, initialize a collection, and input column information. In order to display the correct columns, you need to override columnInit to properly format your column information.

## Credits
Originally developed by [Vecna Technologies, Inc.](http://www.vecna.com/) and open sourced as part of its community service program. See the LICENSE file for more details.
Vecna Technologies encourages employees to give 10% of their paid working time to community service projects.
To learn more about Vecna Technologies, its products and community service programs, please visit http://www.vecna.com.
