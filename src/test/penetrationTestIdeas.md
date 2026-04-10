1. Sending a PUT /api/auth with an empty password succeeding. 
Result: let you sign in and gave you a token. 
Fix: added extra checks to the login request function in the database. 

2. Changing order names and prices
Result: altered order is sent like normal. 
Fix: added check menu items against menu database before sending order to database. 

3. Ordering an item that doesnt exist. 
Result: altered order is sent like normal. 
Fix: check item is in database, return error of not. 

4. Ordering from a store/franchise that doesnt exist. 
Result: altered order is sent like normal. 
Fix: check franchiseId and storeId are in database before sending order to database.

5. Deleting a franchise/store that doesnt exist. 
Result: altered request is sent like normal and does nothing. 
Fix: check item is in database, return error of not. 
