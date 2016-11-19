const gulp = require("gulp");
const emu = require("gulp-emu");
const gls = require("gulp-live-server");
const spawn = require("child_process").spawn;

gulp.task("clean", () => del("out/**/*"));

gulp.task("build", () => gulp
    .src(["src/spec.html"])
    .pipe(emu({ js: true, css: true }))
    .pipe(gulp.dest("out")));

gulp.task("watch", () => gulp
    .watch(["src/**/*"], ["build"]));

gulp.task("start", ["watch"], () => {
    const server = gls.static("out", 8080);
    const promise = server.start();
    gulp.watch(["out/**/*"], file => server.notify(file));
    return promise;
});

gulp.task("update-pages:checkout", () => Promise.resolve()
    .then(() => git(["-C", "./pages", "pull", "--no-stat"])));

gulp.task("update-pages:update", ["update-pages:checkout", "build"], () => gulp
    .src(["out/**/*"])
    .pipe(gulp.dest("pages")));

gulp.task("update-pages:checkin", ["update-pages:update"], () => Promise.resolve()
    .then(() => git(["-C", "./pages", "add", "."]))
    .then(() => git(["-C", "./pages", "commit", "-m", "Deploy to GitHub Pages"]))
    .then(() => git(["-C", "./pages", "push", "--force", "--quiet"])));

gulp.task("update-pages", ["update-pages:checkin"]);

function git(args) {
    return exec("git", args);
}

function exec(cmd, args) {
    return new Promise((resolve, reject) => {
        gutil.log((cmd ? cmd + " " : "") + args.join(" "));
        spawn(cmd || process.argv[0], args, { stdio: "inherit" })
            .on("error", function (e) { reject(e); })
            .on("close", function (code) { code ? reject(new Error("Process exited with code: " + code)) : resolve(); });
    });
}