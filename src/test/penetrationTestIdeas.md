1. Sending a PUT /api/auth with an empty password succeeding. 
Result: let you sign in and gave you a token. 
Fix: added extra checks to the login request function in the database. 

2. Changing order details (items, prices)
Result: altered order is sent like normal. 
Fix: added check menu items against menu database before sending order to database. 

3. Setting the franchiseId/storeId/menuId etc. to a value that doesn't exist when ordering. 
Result: altered order is sent like normal. 
Fix: makes sure the franchise and store are in database before sending order to database.

4. Creating a store in a franchise that doesnt exist. 

5. Deleting a franchise/store that doesnt exist. 