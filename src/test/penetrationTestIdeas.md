1. Sending login request with an empty password. 
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

5. Deleting a store that doesnt exist. 
Result: altered request is sent like normal, response is normal, and does nothing. 
Fix: check store is in database before deleting, return error of not. 

6. Deleting a franchise that doesnt exist. 
Result: altered request is sent like normal, response is normal, and does nothing. 
Fix: check franchise is in database before deleting, return error of not. 

7. Calling GET /api/franchise/ as a diner with no franchiseId
Result: the diner gets franchise with id 1 in the http response. 
Fix: check userId is valid before getting frachise from database. 
