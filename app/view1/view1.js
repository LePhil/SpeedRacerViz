'use strict';

angular.module('myApp.view1', ['ngRoute'])

.config(['$routeProvider', function($routeProvider) {
  $routeProvider.when('/view1', {
    templateUrl: 'view1/view1.html',
    controller: 'View1Ctrl'
  });
}])

.controller('View1Ctrl', ['$scope', '$stompie', '$window', function($scope, $stompie, $window) {
    
    var gridDef = {
          fillStyle:'rgba(0,0,0,0.40)',
          sharpLines: true,
          millisPerLine: 2000,
          verticalSections: 8
        },
        smoothieGyro = new SmoothieChart({
          millisPerPixel: 20,
          labels:{ fontSize:14, precision:0 },
          grid: gridDef,
          timestampFormatter: SmoothieChart.timeFormatter,
          maxValue: 10000,
          minValue: -10000
        }),
        smoothieSpeed = new SmoothieChart({
          interpolation:'linear',
          millisPerPixel: 20,
          labels:{ fontSize:14, precision:0 },
          grid: gridDef,
          timestampFormatter: SmoothieChart.timeFormatter,
          maxValue: 350,
          minValue: 0
        }),
        smoothieRounds = new SmoothieChart({
          interpolation:'step',
          millisPerPixel:50,
          labels:{ fontSize:14, precision:0 },
          grid: {
            fillStyle:'rgba(0,0,0,0.40)',
            sharpLines: true,
            millisPerLine: 2000
          },
          minValue: 0
        }),
        gyroZ = new TimeSeries(),
        power = new TimeSeries(),
        speed = new TimeSeries(),
        round = new TimeSeries(),
        lastSpeed = -1;
    $scope.lastTime;
    $scope.currentRound = 0;
   
    // Add to SmoothieChart
    smoothieGyro.addTimeSeries(gyroZ, { strokeStyle:'#00ff00', lineWidth:3 } );
    smoothieSpeed.addTimeSeries(power, { strokeStyle:'#ff0000', lineWidth:3 } );
    smoothieSpeed.addTimeSeries(speed, { strokeStyle:'#0000ff', lineWidth:3 } );
    smoothieRounds.addTimeSeries(round, { strokeStyle:'#0000ff', lineWidth:3 } );

    var saveData = function( msg ) {
      var t = new Date().getTime();
      gyroZ.append( t, msg.event['g'][2] );
      power.append( t, msg.currentPower );

      // only log speed if it actually changed
      if ( msg.velocity != lastSpeed ) {
        speed.append( t, msg.velocity );
        lastSpeed = msg.velocity;
      }

      if ( msg.roundNumber > $scope.currentRound ) {
        round.append( t, Math.abs($scope.lastTime - msg.event.timeStamp ) );

        $scope.lastTime = msg.event.timeStamp;
        $scope.currentRound = msg.roundNumber;
      }
    }

    $scope.width = 600;
    $scope.$watch(function(){
      return $window.innerWidth;
    }, function(value) {
      console.log(value);
      $scope.width = value;
    });

    $scope.stop = function() {
      // Disconnect from the socket.
      $stompie.disconnect(function () {
          // Called once you're out...
      });
    };

    $scope.start = function() {

      smoothieGyro.streamTo(document.getElementById("gyroCanvas"));
      smoothieSpeed.streamTo(document.getElementById("speedCanvas"));
      smoothieRounds.streamTo(document.getElementById("roundCanvas"));

      $stompie.using('http://localhost:8089/messages', function () {

        // The $scope bindings are updated for you so no need to $scope.$apply.
        // The subscription object is returned by the method.
        var subscription = $stompie.subscribe('/topic/simulator/news', function (msg) {

            // Save data point for visualisation (just the gyro value)
            saveData( msg );
        });

      });

    };

    $scope.start();
}]);
