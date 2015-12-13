'use strict';

angular.module('myApp.view1', ['ngRoute'])

.config(['$routeProvider', function($routeProvider) {
  $routeProvider.when('/view1', {
    templateUrl: 'view1/view1.html',
    controller: 'View1Ctrl'
  });
}])

.controller('View1Ctrl', ['$scope', '$stompie', '$window', function($scope, $stompie, $window) {
    $scope.gyroColor = '#00ff00';
    $scope.powerColor = '#ff0000';
    $scope.speedColor = '#0000ff';

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
        gyroZ = new TimeSeries(),
        power = new TimeSeries(),
        speed = new TimeSeries(),
        lastSpeed = -1;
    $scope.lastTime;
    $scope.currentRound = 0;

    var roundTimeChart = new CanvasJS.Chart("roundTimesContainer", {
    		data: [{
    			type: "spline",
    			dataPoints: []
    		}]
    });

    // Add to SmoothieChart
    smoothieGyro.addTimeSeries(gyroZ, { strokeStyle: $scope.gyroColor, lineWidth:3 } );
    smoothieSpeed.addTimeSeries(power, { strokeStyle: $scope.powerColor , lineWidth:3 } );
    smoothieSpeed.addTimeSeries(speed, { strokeStyle: $scope.speedColor, lineWidth:3 } );

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
            var roundTime = Math.abs( $scope.lastTime - msg.event.timeStamp );
            $scope.lastTime = msg.event.timeStamp;
            $scope.currentRound = msg.roundNumber;

            console.log( roundTime );

            roundTimeChart.options.data[0].dataPoints.push({ y: roundTime });
            //TODO: trend of all the roundTimes (except the first one because it can be messed up if started too late)
            roundTimeChart.render();
        }
    };

    // handle resizing --> adjust the canvas' width accordingly
    $scope.width = 600;
    $scope.$watch(function(){
      return $window.innerWidth;
    }, function(value) {
      $scope.width = value;
    });

    $scope.isRunning = true;
    $scope.pause = function() {
      if ( $scope.isRunning )  {
        smoothieGyro.stop();
        smoothieSpeed.stop();
      } else {
        smoothieGyro.start();
        smoothieSpeed.start();
      }
      $scope.isRunning = !$scope.isRunning;
    }

    $scope.stop = function() {
      // Disconnect from the socket.
      $stompie.disconnect(function () {
          // Called once you're out...
      });
    };

    $scope.start = function() {

      smoothieGyro.streamTo(document.getElementById("gyroCanvas"));
      smoothieSpeed.streamTo(document.getElementById("speedCanvas"));
      roundTimeChart.render();

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
