// output stuff to debug log
debugLog = function debugLog(msg) {
	var time = new Date();
	console.log('[' +
		(time.getMonth() + 1) +
		'/' + time.getDate() +
		'/' + time.getFullYear() +
		'-' + time.getHours() +
		':' + time.getMinutes() +
		':' + time.getSeconds() +
	']', msg);
};
