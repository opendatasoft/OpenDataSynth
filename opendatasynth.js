angular.module('ods-widgets').service('waveSurferService', function () {
    var duration = 2; //2 second of audio
    var sampleRate = 44100; //Works in most browsers
    var numOfSamples = duration * sampleRate;
    var context = new AudioContext();

    var wavesurfer = WaveSurfer.create({
        container: '#waveform',
        fillParent: true,
        scrollParent: false,
        waveColor: '#337AC4',
        progressColor: '#2b669a'
    });

    var audioBuffer = context.createBuffer(1, numOfSamples, sampleRate);
    var dataBuffer = audioBuffer.getChannelData(0);
    for (var i = 0; i < numOfSamples ; i += 1) {
        dataBuffer[i] = 0;
    }
    wavesurfer.loadDecodedBuffer(audioBuffer);

    return {
        loadAsAudio: function(recVals) {
            var smooth = Smooth(recVals);
            var audioBuffer = context.createBuffer(1, numOfSamples, sampleRate);
            var dataBuffer = audioBuffer.getChannelData(0);
            // Loop on future sample indices, compute sample value and stick it in audio buffer
            for (var i = 0; i < numOfSamples ; i += 1) {
                var nval = smooth(i * recVals.length / numOfSamples);
                dataBuffer[i] = nval;
            }
            wavesurfer.empty();
            return wavesurfer.loadDecodedBuffer(audioBuffer);
        },
        play: function() {
            return wavesurfer.play();
        }
    };
});


angular.module('ods-widgets').controller('OpenDataSynthController', ['$scope', '$http', 'waveSurferService', function($scope, $http, waveSurferService) {
    $scope.working = false;
    $scope.domUrl = null;
    $scope.dts = {
        id: null
    };
    $scope.local = {
        fld: null,
        srt: null
    };

    $scope.fieldSortable = function(item) {
        if (item.type === "int" || item.type === "double" || item.type === "date" || item.type === "datetime") {
            return true;
        }
        if (! item.annotations) {
            return false;
        }
        for (var i = 0 ; i < item.annotations.length; i += 1) {
            if (item.annotations[i].name === "sortable") {
                return true;
            }
        }
        return false;
    };

    $scope.fieldNumeric = function(item) {
        return item.type === "int" || item.type === "double";
    };

    $scope.$watch('local', function(nv, ov) {
        if (! ($scope.dts.id && $scope.local.fld) ) {
            // The user is still working on the selection
            return;
        }
        $scope.working = true;
        var url = $scope.$$childHead.catctx.domainUrl + "/api/records/1.0/search/?rows=10000&dataset=" + $scope.dts.id;
        if ($scope.local.srt) {
            url += "&sort=-" + $scope.local.srt;
        }
        $http.get(url).then(function(result) {
            var records = result.data.records;
            var numOfRecords = records.length;
            // Find min and max val, so we can normalize values later.
            // Use the loop to create a tidier array that we can feed to smooth
            var minVal = null;
            var maxVal = null;
            var recVals = [];
            for (var i = 0; i < numOfRecords; i += 1) {
                var fval = records[i].fields[$scope.local.fld];
                if (typeof fval === "number" && fval === fval) {
                    // avoid type errors
                    if (minVal === null || fval < minVal) {
                        minVal = fval;
                    }
                    if (maxVal === null || fval > maxVal) {
                        maxVal = fval;
                    }
                    recVals.push(fval);
                }
            }
            if (maxVal !== minVal) {
                // Normalize the list of values in the interval [-1,1] in order to create a PCM audio waveform
                recVals = recVals.map(function(val) {
                    return 2 * ((val - minVal) / (maxVal - minVal)) - 1;
                });
            } else {
                // let's not divide by 0. Instead since that thing is a flat line, let's make it flat for real.
                recVals = [0];
            }
            // Add 0 value at beginning and end to create a fade in/out, avoiding pops
            recVals.unshift(0);
            recVals.push(0);
            // Create a smooth function in order to interpollate extra points in interval
            waveSurferService.loadAsAudio(recVals);
            $scope.working = false;
        });
    }, true);
}]);

angular.module('ods-widgets').controller('CatalogContextController', ['$scope', 'waveSurferService', function($scope, waveSurferService) {
    $scope.play = waveSurferService.play;
    $scope.$watch('catctx.parameters.q', function() {
        $scope.catctx.parameters.start = 0;
    });
}]);