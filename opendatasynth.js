var source, wavesurfer;
var domain = "https://data.opendatasoft.com";
var context = new AudioContext();

var suggestedDatasets = function(req, res) {
    var search = req.term;
    $.get(domain + "/api/datasets/1.0/search/?sort=modified&refine.features=analyze&rows=10&q=" + search, function(result) {
        data = result.datasets.map(function(dataset) {
           return {
               value: dataset.datasetid,
               label: dataset.metas.title + "(" + dataset.metas.source_domain_title + ")"
           };
        });
        return res(data);    
    });    
};
$("#dataset").autocomplete({
    source: suggestedDatasets
});

$("#dataset").change(function(){
    var fieldSelect = $('#field');
    fieldSelect.empty();
    var datasetId = $("#dataset")[0].value;
    $.get(domain + "/api/datasets/1.0/" + datasetId + "/", function(result) {
        var numericFields = result.fields.filter(function(field) {
            return field.type === "double" || field.type === "int";
        });
        if (numericFields.length === 0) {
            return fieldSelect.append(new Option('No suitable field :(', 'null'));
        }
        numericFields.map(function(numericField) {
            fieldSelect.append(new Option(numericField.label, numericField.name));
        });
    });
});
$("#dataset").change();

var play = function() {
    if (source) {
      source.start();
    }
    $("#go")[0].hidden = false;
    $("#play")[0].hidden = true;
};

var go = function() {
    if (wavesurfer) {
        wavesurfer.destroy();
        $("#play")[0].hidden = false;
    }
    var datasetId = $("#dataset")[0].value;
    var fieldToListenTo = $("#field")[0].value;
  
    $.get(domain + "/api/records/1.0/search/?rows=10000&dataset=" +  datasetId, function(result) {
        var records = result.records;
        var numOfRecords = records.length;
        // Find min and max val. Set everything to first elem and skip it in loop
        // Use the loop to create a tidier array
        var minVal = records[0].fields[fieldToListenTo];
        var maxVal = records[0].fields[fieldToListenTo];
        var recVals = [];

        for (var i = 1; i < numOfRecords; i += 1) {
            var fval = records[i].fields[fieldToListenTo];
            if (typeof fval === "number" && fval === fval) {
                // avoid type errors
                if (fval < minVal) {
                    minVal = fval;
                }
                if (fval > maxVal) {
                    maxVal = fval;
                }
                recVals.push(fval);
            }
        }

        console.debug("found min", minVal, "and max", maxVal);

        // Normalize the list of values in the interval [-1,1] in order to create
        // a PCM audio waveform
        recVals = recVals.map(function(val) {
            return 2 * ((val - minVal) / (maxVal - minVal)) - 1;
        });

        // Add 0 value at beginning and end to create a fade in/out, avoiding pops
        recVals.unshift(0);
        recVals.push(0);

        // Create a smooth function in order to interpollate extra points in interval
        var smooth = Smooth(recVals);

        //set up audio
        var duration = 2; //2 second of audio
        var sampleRate = 44100; //Works in firefox and chrome. Not pretty though
        var numOfSamples = duration * sampleRate;

        var audioBuffer = context.createBuffer(1, numOfSamples, sampleRate);
        var dataBuffer = audioBuffer.getChannelData(0);
        // Loop on future sample indices, compute sample value and stick it in audio buffer
        for (var j = 0; j < numOfSamples ; j += 1) {
            //if ( j % Math.floor(numOfSamples / 10) === 0) console.log((100 * j / numOfSamples) + "%");
            var nval = smooth(j * recVals.length / numOfSamples);
            dataBuffer[j] = nval;
        }

        wavesurfer = WaveSurfer.create({
            container: '#waveform',
            waveColor: 'violet',
            progressColor: 'purple'
        });
        wavesurfer.loadDecodedBuffer(audioBuffer);
        $("#play")[0].hidden = false;     
    });
};