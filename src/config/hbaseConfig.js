import hbase from 'hbase';

const client = hbase({ host: '127.0.0.1', port: 10005 });

export default client;
