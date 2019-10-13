# Ferry Schedule

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app). It's used 
to power https://larkspur.ferryschedule.mobi/

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.<br>
Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

The page will reload if you make edits.<br>
You will also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.<br>
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.<br>
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.<br>
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### `yarn run deploy`
Deploy the built, static assets to github

## Refreshing Data
This is done outside the scope of this codebase, but it's just:

```
wget "https://api.511.org/transit/timetable?api_key=YOUR_API_KEY_HERE&format=json&operator_id=GF&line_id=LF" -O timetable.json
```

from the `src/` folder

## Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).
