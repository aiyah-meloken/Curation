# 获取文章详情(纯文本,富文本,不带html文章格式)

## OpenAPI Specification

```yaml
openapi: 3.0.1
info:
  title: ''
  description: ''
  version: 1.0.0
paths:
  /fbmain/monitor/v3/article_detail:
    get:
      summary: 获取文章详情(纯文本,富文本,不带html文章格式)
      deprecated: false
      description: |-
        ## **关于图片显示
        ## 此图片来自微信公众平台
        ## 未经允许不可引用**

        解决办法：

        ```
        <head></head> 里面加上  一句

        <meta name="referrer" content="never">

        ```



        就可以正常显示了


        |                 状态码                 |          说明          |
        |:-----------------------------------:|:--------------------:|
        | {"message":"Internal Server Error"} |     网络错误，请重试1~3次     |
        |             0             |          成功          |
        |              101        |     文章被删除或违规或公众号已迁移    |
        |             105,106        |          文章解析失败           |
        |             107        |          解析失败，请重试          |

        qps=5


        ### 返回结果
        | 字段 | 说明 |
        | --- | --- |
        | ['code'] | 状态码 |
        | ['cost_money'] | 消费金额 |
        | ['remain_money'] | 所剩金额 |
        | ['type'] | 9 群发的有通知  10002 发布无通知 |
        | ['content'] | 纯文本格式正文 |
        | ['content_multi_text'] | 适用于富文本编辑器的html格式 |
        | ['title'] | 文章标题 |
        | ['url'] | 文章长链接 |
        | ['hashid'] | 文章唯一id |
        | ['mp_head_img'] | 公众号头像 |
        | ['picture_page_info_list'] | 文章中图片列表 |
        | ['cdn_url_1_1'] | 1:1的封面图 |
        | ['nick_name'] | 公众号名字 |
        | ['user_name'] | 公众号原始id |
        | ['idx'] | 文章位置，8篇里面第几篇 |
        | ['msg_daily_idx'] | 比如人民日报一天可以发10次，这是第几次发送 |
        | ['pubtime'] | 发文时间 |
        | ['create_time'] | 文章创建（定时）时间 |
        | ['biz'] | 公众号biz |
        | ['alias'] | 公众号wxid |
        | ['source_url'] | 文章原文链接 （如果没有则为空） |
        | ['signature'] | 公众号简介 |
        | ['author'] | 文章作者 |
        | ['desc'] | 文章摘要 |
        | ['copyright_stat'] | 是否原创 （1 原创 0非原创 2转载） |
        | ['ip_wording'] | ip地址|
        | ['item_show_type'] | 0:图文 5:纯视频 7:纯音乐 8:纯图片 10:纯文字 11:转载文章 |
        | ['real_item_show_type'] | 0:图文 5:纯视频 7:纯音乐 8:纯图片 10:纯文字 11:转载文章 |
        | ['video_page_infos'] | 文章中的视频列表 |
      tags:
        - 公众号文章内容和互动数据等
        - 文章
      parameters:
        - name: url
          in: query
          description: 微信文章链接 （ 0.03/次）
          required: false
          example: https://mp.weixin.qq.com/s/NrR7SnT8DUwufP88uUESjg
          schema:
            type: string
        - name: key
          in: query
          description: 极致了官网 key
          required: false
          example: '{{key}}'
          schema:
            type: string
        - name: mode
          in: query
          description: '1.带图片标签纯文本    2.纯文字+富文本格式 '
          required: false
          example: '2'
          schema:
            type: string
        - name: verifycode
          in: query
          description: 附加码 (如设置了附加码verifycode，则此参数为必选，如未设置则为非必选)
          required: false
          schema:
            type: string
      responses:
        '200':
          description: ''
          content:
            application/json:
              schema:
                type: object
                properties:
                  code:
                    type: integer
                    description: 状态码
                  cost_money:
                    type: number
                    description: 消费金额
                  remain_money:
                    type: number
                    description: 所剩金额
                  title:
                    type: string
                    description: 文章标题
                  mp_head_img:
                    type: string
                    description: 公众号头像
                  source_url:
                    type: string
                    description: 文章原文链接 （如果没有则为空）
                  signature:
                    type: string
                    description: 公众号简介
                  author:
                    type: string
                    description: 文章作者
                  desc:
                    type: string
                    description: 文章摘要
                  content:
                    type: string
                    description: 纯文本格式正文
                  url:
                    type: string
                    description: 文章长链接
                  hashid:
                    type: string
                    description: 文章唯一id
                  pubtime:
                    type: string
                    description: 发文时间
                  biz:
                    type: string
                    description: 公众号biz
                  create_time:
                    type: string
                    description: 文章创建（定时）时间
                  msg_daily_idx:
                    type: string
                    description: 比如人民日报一天可以发10次，这是第几次发送
                  ip_wording:
                    type: string
                    description: ip地址
                  content_multi_text:
                    type: string
                    description: 适用于富文本编辑器的html格式
                  cdn_url_1_1:
                    type: string
                    description: 1:1的封面图
                  nick_name:
                    type: string
                    description: 公众号名字
                  user_name:
                    type: string
                    description: 公众号原始id
                  idx:
                    type: string
                    description: 文章位置，8篇里面第几篇
                  alias:
                    type: string
                    description: 公众号wxid
                  copyright_stat:
                    type: integer
                    description: 是否原创 （1 原创 0非原创 2转载）
                  picture_page_info_list:
                    type: array
                    items:
                      type: object
                      properties: {}
                      x-apifox-orders: []
                    description: 文章中图片列表
                  video_page_infos:
                    type: array
                    items:
                      type: object
                      properties: {}
                      x-apifox-orders: []
                    description: 文章中的视频列表
                  type:
                    type: integer
                    description: 9 群发的有通知  10002 发布无通知
                  item_show_type:
                    type: integer
                    description: 0:图文 5:纯视频 7:纯音乐 8:纯图片 10:纯文字 11:转载文章
                  real_item_show_type:
                    type: integer
                    description: 0:图文 5:纯视频 7:纯音乐 8:纯图片 10:纯文字 11:转载文章
                  verify_status:
                    type: string
                    description: 2 蓝V认证  3 红V认证  1个人认证  0  未认证
                required:
                  - code
                  - cost_money
                  - remain_money
                  - title
                  - url
                  - mp_head_img
                  - nick_name
                  - pubtime
                  - biz
                  - user_name
                  - alias
                  - source_url
                  - signature
                  - author
                  - desc
                  - copyright_stat
                  - content
                  - hashid
                  - idx
                  - create_time
                  - msg_daily_idx
                  - ip_wording
                  - content_multi_text
                  - cdn_url_1_1
                  - picture_page_info_list
                  - video_page_infos
                  - type
                  - item_show_type
                  - real_item_show_type
                  - verify_status
                x-apifox-orders:
                  - code
                  - cost_money
                  - remain_money
                  - type
                  - content
                  - content_multi_text
                  - title
                  - url
                  - hashid
                  - mp_head_img
                  - picture_page_info_list
                  - cdn_url_1_1
                  - nick_name
                  - user_name
                  - idx
                  - verify_status
                  - msg_daily_idx
                  - pubtime
                  - create_time
                  - biz
                  - alias
                  - source_url
                  - signature
                  - author
                  - desc
                  - copyright_stat
                  - ip_wording
                  - item_show_type
                  - real_item_show_type
                  - video_page_infos
          headers: {}
          x-apifox-name: 成功
        x-200:文章被删除:
          description: ''
          content:
            application/json:
              schema:
                type: object
                properties:
                  cost_money:
                    type: number
                  remain_money:
                    type: number
                  code:
                    type: integer
                  msg:
                    type: string
                required:
                  - cost_money
                  - remain_money
                  - code
                  - msg
                x-apifox-orders:
                  - cost_money
                  - remain_money
                  - code
                  - msg
          headers: {}
          x-apifox-name: 文章被删除
        x-200:文章审核失败:
          description: ''
          content:
            application/json:
              schema:
                type: object
                properties:
                  cost_money:
                    type: number
                  remain_money:
                    type: number
                  code:
                    type: integer
                  msg:
                    type: string
                required:
                  - cost_money
                  - remain_money
                  - code
                  - msg
                x-apifox-orders:
                  - cost_money
                  - remain_money
                  - code
                  - msg
          headers: {}
          x-apifox-name: 文章审核失败
      security: []
      x-apifox-folder: 公众号文章内容和互动数据等
      x-apifox-status: released
      x-run-in-apifox: https://app.apifox.com/web/project/4919579/apis/api-220474677-run
components:
  schemas: {}
  securitySchemes: {}
servers:
  - url: https://www.dajiala.com
    description: 正式环境
security: []

```