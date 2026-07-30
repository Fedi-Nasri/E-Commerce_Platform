var String = Java.type('java.lang.String')

function authenticate(helper, paramsValues, credentials) {
  var email = credentials.getParam('email')
  var password = credentials.getParam('password')

  var msg = helper.prepareMessage()
  var uri = new java.net.URI('http://localhost:3000/login', false)
  msg.getRequestHeader().setURI(uri)
  msg.getRequestHeader().setMethod('POST')
  msg.getRequestHeader().setHeader('Content-Type', 'application/json')
  msg.getRequestHeader().setHeader('Accept', 'application/json')

  var body = JSON.stringify({ email: email, password: password })
  msg.setRequestBody(new String(body))
  msg.getRequestHeader().setContentLength(msg.getRequestBody().length)

  helper.sendMessage(msg, true)

  var responseBody = msg.getResponseBody().toString()
  var json = JSON.parse(responseBody)
  var token = json.data && json.data.access_token

  if (!token) {
    return false
  }

  var session = helper.getHttpSender().getSession()
  session.setHeader('Authorization', 'Bearer ' + token)

  return true
}

function getRequiredParamsNames() {
  return []
}

function getOptionalParamsNames() {
  return []
}

function getCredentialsParamsNames() {
  return ['email', 'password']
}
