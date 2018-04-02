del bundle.zip /f /q
winrar a -afzip bundle.zip index.js node_modules
aws lambda update-function-code --function-name jsPsychMiddleman --zip-file fileb://bundle.zip