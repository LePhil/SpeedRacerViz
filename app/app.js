'use strict';

// Declare app level module which depends on views, and components
angular.module('myApp', [
  'myApp.view1',
  'myApp.view2',
  'myApp.version',
  'stompie'
]).
config(['$routeProvider', function($routeProvider) {
  $routeProvider.otherwise({redirectTo: '/view1'});
}]);
