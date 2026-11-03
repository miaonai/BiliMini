import axios from "axios";


const handleRequest = async function (url, method = 'get', data = false) {
    if (method === 'get') {
        try {
            const response = await axios.get(url);
            return response.data;
        }
        catch (e) {
            console.error('api请求: ' + e);
            return false;
        }
    } else if (method === 'post') {
        try {
            const response = await axios.post(url, data);
            return response.data;
        }
        catch (e) {
            console.error('api请求: ' + e);
            return false;
        }
    }
}

// 获取动态
const getDynamicData = async function (type, updateBaseline = false, offset = false) {
    console.log('offset: ' + offset)
    let url = `https://api.bilibili.com/x/polymer/web-dynamic/v1/feed/all?type=${type}`;
    if (updateBaseline) {
        url += `&update_baseline=${updateBaseline}`;
    }
    if (offset) {
        url += `&offset=${offset}`;
    }

    const responseData= await handleRequest(url);
    return responseData;
}

// 获取综合热门，与官方热门页使用同一分页接口。
const getPopularData = async function (page = 1, pageSize = 20) {
    return handleRequest(`https://api.bilibili.com/x/web-interface/popular?pn=${page}&ps=${pageSize}`);
}

//获取稍后再看
const getToWatchData = async function () {
    const responseData= await handleRequest('https://api.bilibili.com/x/v2/history/toview');
    return responseData;
}

//添加稍后再看
const addToWatchData = async function (aid, jct) {
    const responseData= await handleRequest('https://api.bilibili.com/x/v2/history/toview/add', 'post', new URLSearchParams({
        'jsonp': 'jsonp',
        'aid': aid,
        'csrf': jct,
    }));
    return responseData;
}

//删除稍后再看
const delTowatchData = async function (aid, jct) {
    const responseData= await handleRequest('https://api.bilibili.com/x/v2/history/toview/del', 'post', new URLSearchParams({
        'jsonp': 'jsonp',
        'aid': aid,
        'csrf': jct,
    }));
    return responseData;
}

//获取直播
const getLiveData = async function (page = 1, pageSize = 10) {
    const responseData= await handleRequest(`https://api.live.bilibili.com/relation/v1/feed/feed_list?page=${page}&pagesize=${pageSize}`)
    return responseData;
}

//获取历史记录
const getHistoryData = async function (cursor = null) {
    const params = new URLSearchParams({ type: 'archive', ps: 20,
        max: cursor?.max || 0, view_at: cursor?.view_at || 0, business: cursor?.business || '',
    });
    const responseData= await handleRequest(`https://api.bilibili.com/x/web-interface/history/cursor?${params}`)
    return responseData;
}

export {
    getDynamicData,
    getPopularData,
    getToWatchData,
    addToWatchData,
    delTowatchData,
    getLiveData,
    getHistoryData,
}
