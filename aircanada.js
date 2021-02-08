module.exports = {
	registerEndpoints: registerEndpoints,
}

var pk;
var viewPath;
var app_config; // app_config;
var viewPath;

var safe_fliers = [];
var assigned_seats = {};

async function registerEndpoints(pkSource, acSource) {
	pk = pkSource;
	app_config = acSource;
	
	console.log(app_config.client + ' starting up at ' + Date());

	var possibleError = '';
	try{
		viewPath = pk.app.settings.views;

		// Set up endpoints
		var endpoint = app_config.applicationPath + '/landing_Page';
		pk.app.options(endpoint, pk.cors());
		pk.app.post(endpoint, pk.scaffold.corsOptions(), function(req, res){
			landing_page(req, res);
		});

		var endpoint = app_config.applicationPath + '/get_reception_data';
		pk.app.options(endpoint, pk.cors());
		pk.app.get(endpoint, pk.scaffold.corsOptions(), function(req, res){
			get_reception_data(req, res);
		});

		var endpoint = app_config.applicationPath + '/reception_desk';
		pk.app.options(endpoint, pk.cors());
		pk.app.get(endpoint, pk.scaffold.corsOptions(), function(req, res){
			reception_desk(req, res);
		});

		pk.app.get(app_config.applicationPath, pk.scaffold.corsOptions(), function(req, res){
			startApplication(req, res);
		});

	}
	catch(err){
		console.log("*** ERROR ****")
		console.log(possibleError);
		console.log(err);
		process.exit(-1);
	}
}

async function startApplication(req, res) {
	res.set ({
		'Cache-Control': 'no-store',
		'Pragma': 'no-cache'
	});

	var app_instance = {
		target_link_uri: app_config.applicationUrl + '/landing_page'
	};
	
	var response_mode = undefined;
	if (req.query && req.query.post === 'true'){
		response_mode = 'form_post';
	}

	//render the application screen
    res.render(viewPath + '/start_application', {
    	layout: 'main_responsive',
    	app_config: app_config,
    	app_instance_params: JSON.stringify(app_instance),
    	app_config_params: JSON.stringify(app_config),
    	client_api_url: app_config.client_api_url    	
    });
}

async function landing_page(req, res) {
	var params = req.query.error ? req.query : req.body;
	if (params.error){
		await pk.scaffold.landingPageError(params, res, viewPath, app_config.applicationUrl);
	    return;		
	}

	if (!req.body.id_token){
		throw('No id_token at landing_page');
	}
	var iClaims = JSON.parse(req.body.id_token);

	var credentialSubject = iClaims.presentedVcs[0].vc.credentialSubject;
    var instructions;
    if (credentialSubject.status > 30){
    	safe_flyer_add(iClaims, credentialSubject);
    	instructions = credentialSubject.firstName + ' ' + credentialSubject.lastName + ' may enter the Covid Safe Cabin.';
    }
    else{
    	instructions = 'Automated boarding not available.  Immunity status is "' + credentialSubject.status + '"';
    }

	res.render(viewPath + '/board', {
    	layout: 'main_responsive',
    	iClaims: iClaims,
    	credentialSubject: credentialSubject,
    	instructions: instructions
    });
}

function safe_flyer_add(iClaims, credentialSubject){
	var safe_flyer = {
		index: safe_fliers.length,
		time: Date.now(),
		family_name: credentialSubject.lastName,
		given_name: credentialSubject.firstName,
		seat: nextSeat(),
		photo: iClaims.photo
	}

	safe_fliers.push(safe_flyer);

	function nextSeat(){
		var tries = 0;
		while (tries++ < 3){
			var seatPositions = ['A', 'B', 'C', 'D'];
			var row = Math.floor((Math.random() * 6) + 1);
			var seatPosition = Math.floor((Math.random() * 4) + 1) - 1;
			var seat = row.toString() + seatPositions[seatPosition];
			if (!assigned_seats[seat]){
			  assigned_seats[seat] = true;
			  return seat;
			}
		}
		return ("No seat");
	}
}

async function reception_desk(req, res) {
	res.render(viewPath + '/reception_desk', {
		layout: 'main_responsive'
    });
}

function get_reception_data(req, res){
	if (req.query.clear){
		safe_fliers = [];
		assigned_seats = {};
		return;
	}

	var index = 0;
	if (req.query.index){
		index = parseInt(req.query.index);
	}

	var startIndex = index;
	var result = safe_fliers.slice(startIndex, safe_fliers.length);
	res.send(result);
}
