const AWS = require('aws-sdk'),
	  https = require('https'),
	  Experiment_Table_Name = "jsPsych_Builder_Experiments",
	  short_uuid = require('short-uuid');


function getUUID() {
	var translator = short_uuid();
	//var decimalTranslator = short("0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ");
	let res = translator.new();
	return res;
}


function uploadFileToOSF(
	token,
	data,
	parentNodeId,
	callback
) {
	let filename = `${getUUID()}-[${Date.now()}].csv`,
		putOptions = {
			hostname: "files.osf.io",
			path: `/v1/resources/${parentNodeId}/providers/osfstorage/?kind=file&name=${filename}/`,
			method: "PUT",
			headers: {
				"Content-Type": "application/vnd.api+json",
				"Content-Length": Buffer.byteLength(data),
				"Authorization": `Bearer ${token}`
			}
		};

	const req = https.request(putOptions, (res) => {
		callback(null, res.statusCode);
	})

	req.on('error', (e) => {
		callback(e);
	});

	req.write(data);
	req.end();
}

function connectDynamoDB() {
	return new(AWS.DynamoDB.DocumentClient)({
		apiVersion: '2012-08-10',
	});
}

function getItem(param) {
	return connectDynamoDB().get(param).promise();
}


function fetchExperimentById(id) {
	let param = {
		TableName: Experiment_Table_Name,
		Key: {
			'experimentId': id
		},
		AttributesToGet: [ 'fetch' ] // fetch update local state needed info
	};
	return getItem(param);
}

exports.handler = (event, context, callback) => {
	context.callbackWaitsForEmptyEventLoop = false;
	let {
		experimentData,
		experimentId
	} = event;

	fetchExperimentById(experimentId).then((data) => {
		if (!data) {
			throw `Invalid experiment - ${experimentId}`;
		} else {
			let cloudDeployInfo = data.Item.fetch.cloudDeployInfo;

			if (!cloudDeployInfo) {
				throw new Error("This experiment is not ready.");
			}

			let { osfToken } = cloudDeployInfo.osfAccess,
				osfNode = cloudDeployInfo.osfNode;

			if (!osfToken) {
				throw new Error("OSF Authorization Token is not set for this experiment.");
			}
			if (!osfNode) {
				throw new Error("Data destination is not set for this experiment.");
			}

			uploadFileToOSF(osfToken, experimentData, osfNode, callback);
		}
	}).catch((err) => {
		callback(err);
	})

};