const AWS = require('aws-sdk'),
	  https = require('https'),
	  User_Table_Name = "jsPsych_Builder_Users",
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
	lambdaContext
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
		lambdaContext.succeed(res.statusCode);
	})

	req.on('error', (e) => {
		lambdaContext.fail(e);
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

function getUserData(id) {
	let param = {
		TableName: User_Table_Name,
		Key: {
			'userId': id
		}
	};
	return getItem(param);
}

exports.handler = (event, context, callback) => {
	let {
		// experiment creator id (jspsych builder side)
		userId,
		// osf parent node id
		osfFolderId,
		// should be string
		experimentData
	} = event;

	getUserData(userId).then((data) => {
		if (!data) {
			throw `Invalid account id ${userId}`;
		} else {
			let osfToken = data.Item.fetch.osfToken;

			if (!osfToken) {
				throw new Error("OSF Token is not set for this account.");
			}

			uploadFileToOSF(osfToken, experimentData, osfFolderId, context);
		}
	}).catch((err) => {
		context.fail(err);
	})

};