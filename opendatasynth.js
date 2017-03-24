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

        //set up audio
        var duration = 2; //2 second of audio
        var sampleRate = 44100; //Works in firefox and chrome. Not pretty though
        var numOfSamples = duration * sampleRate;

        var audioBuffer = context.createBuffer(1, numOfSamples, sampleRate);
        var dataBuffer = audioBuffer.getChannelData(0);
        var normalize = function(val) {
            return 2 * ((val - minVal) / (maxVal - minVal)) - 1;  
        };
        console.debug("Smoothing values");
        var smooth = Smooth(recVals);
        // loop on future samples, normalize field value, and stick it in audio buffer
        console.debug("Filling buffer");
        for (var j = 0; j < numOfSamples ; j += 1) {
            //if ( j % Math.floor(numOfSamples / 10) === 0) console.log((100 * j / numOfSamples) + "%");
            var nval = normalize(smooth(j * recVals.length / numOfSamples));
            //console.log(nval);
            dataBuffer[j] = nval;
        }

        //playback
        //source = context.createBufferSource();
        //source.buffer = audioBuffer;
        wavesurfer = WaveSurfer.create({
            container: '#waveform',
            waveColor: 'violet',
            progressColor: 'purple'
        });
        wavesurfer.loadDecodedBuffer(audioBuffer);
        //source.connect(context.destination);
        //$("#go")[0].hidden = true;
        $("#play")[0].hidden = false;     
    });
};