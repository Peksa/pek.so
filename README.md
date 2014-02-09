pek.so
======

pek.so is a custom URL-shortener for private use. It is hosted entirely on Amazon AWS and is backend free!

You can download and use this code in order to create your own private URL-shortener!

Demo
----
* http://pek.so
* http://pek.so/about
* http://pek.so/A9P
* http://pek.so/t


![Admin GUI](https://dl.dropboxusercontent.com/u/12279637/pekso.png)

Setup your own URL-shortener
----------------------------

Requirements:

* A custom domain (i.e. pek.so)
* Amazon AWS (S3, IAM, Route53, CloudFront optional)
* Facebook app.
* A personal Facebook account.


Step 1. Setup S3 bucket
-------------------------------------------------
Let's setup an S3 bucket to host our URL-shortener.

1. Create a S3 bucket in the AWS console, name it the name of your domain, i.e. 'pek.so'.
2. Grant s3:GetObject permissions to everyone for the bucket:
    
    ```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AddPerm",
      "Effect": "Allow",
      "Principal": {
        "AWS": "*"
      },
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::pek.so/*"
    }
  ]
}
    ```

3. Add CORS configuration to the bucket:

    ```xml
<?xml version="1.0" encoding="UTF-8"?>
<CORSConfiguration xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
    <CORSRule>
        <AllowedOrigin>*</AllowedOrigin>
        <AllowedMethod>HEAD</AllowedMethod>
        <AllowedMethod>GET</AllowedMethod>
        <AllowedMethod>PUT</AllowedMethod>
        <AllowedMethod>POST</AllowedMethod>
        <AllowedMethod>DELETE</AllowedMethod>
        <MaxAgeSeconds>3000</MaxAgeSeconds>
        <ExposeHeader>ETag</ExposeHeader>
        <ExposeHeader>x-amz-request-id</ExposeHeader>
        <ExposeHeader>x-amz-website-redirect-location</ExposeHeader>
        <AllowedHeader>*</AllowedHeader>
    </CORSRule>
</CORSConfiguration>
    ```

4. Enable website hosting on the S3 bucket, and set the Index Document to 'index.html'

Step 2. Setup Route 53
----------------------
1. Create a new hosted zone for your domain.
2. Point your domain nameserver (via your domain providers control panel) to the nameserver provided by Route 53.
3. Setup an A pointer for your root domain with Alias to point at your bucket, i.e. 'pek.so.s3-website-eu-west-1.amazonaws.com'

Step 3. Setup Facebook application
----------------------------------
Now we'll create a facebook application. This will allow you to administer your URL-shortener directly online by logging into Facebook.

1. Create a new Facebook app on http://developers.facebook.com
2. Set Site URL to your domain, i.e. http://pek.so
3. Set App Domains to your domain, i.e. pek.so
4. Make a note of your Facebook App ID which will be used later, i.e. 602729056487961.

Step 4. Configure IAM
---------------------
Now we'll add a role that will allow only you to modify contents of your S3 bucket after you've logged into Facebook.

1. In the AWS console, head to IAM and create a new role. Name it anything, I've named mine 'pek.so'.
2. Select 'Role for Identity Provider Access'
3. Select 'Grant access to web identity providers'
4. Select Identity Provider: Facebook and enter your Facebook application id.
5. Click 'Add conditions', make sure Condition is StringEquals and select Key: 'graph.facebook.com:id'
6. Enter your own personal facebook id. If you don't know it, the simplest way to find it is to go to http://graph.facebook.com/fbusername, i.e. http://graph.facebook.com/peksa, my user id is 717273996.
7. After you've saved your conditition, continue.
8. Your Trust Policy Document should now look similiar to mine:

    ```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Principal": {
        "Federated": "graph.facebook.com"
      },
      "Condition": {
        "StringEquals": {
          "graph.facebook.com:id": "717273996",
          "graph.facebook.com:app_id": "602729056487961"
        }
      }
    }
  ]
}
    ```
9. Select Custom Policy, give it any name, i.e. pek.so-20140209, with the following document:

    ```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "Stmt1391915077000",
      "Effect": "Allow",
      "Action": [
        "s3:DeleteObject",
        "s3:GetObject",
        "s3:ListBucket",
        "s3:PutObject"
      ],
      "Resource": [
        "arn:aws:s3:::pek.so",
        "arn:aws:s3:::pek.so/*"
      ]
    }
  ]
}
    ```
10. Save the Role ARN that you'll see for later, i.e. arn:aws:iam::507606061091:role/pek.so

Step 5. Configure the admin application
---------------------------------------
Clone this repo, modify the js/app.js file and upload it to the root of your S3 bucket.
The parts that need changing in app.js are:

```javascript
pekso.service('$config', function() {
    this.fbAppId = '602729056487961';
    this.awsS3Bucket = 'pek.so';
    this.awsWebIdentityRole = 'arn:aws:iam::507606061091:role/pek.so';
    this.awsRegion = 'eu-west-1';
    this.domain = 'http://pek.so'; // avoid trailing slash
});
```

And you should be done! Head over to your domain, login and shorten some urls! :)


TODO
------
CloudFront configuration.

