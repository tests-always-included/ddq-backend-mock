Contributing
============

A guide to contributing for DDQ Backend Mock.

## Getting started

1. Fork the repo. There is a very simple way of doing this on [GitHub](https://help.github.com/articles/fork-a-repo/).
    * Following steps may not be needed if forked properly, but in case you can't get to the upstream server.
        1. Configure the upstream server by running `git remote add upstream <repo address>` or editing your `.git/config` under `[remote "upstream"]`, changing `url`.
2. Create a branch off master `git checkout -b <branch name>`. You don't want to do any work off master as this is where you will pull in upstream changes and merge them into your branches. Also is a good idea to push this remotely `git push -u origin <branch name>`.
3. Write your code as normal.  Be sure to follow the [Tests-Always-Included Style Guide](https://tests-always-included.github.io/style-guide/)

Before creating a pull request it's a good idea to pull in the upstream changes, just in case someone has created a pull request before you and it has been merged in.

1. Checkout the master branch `git checkout master`.
2. Run `git fetch upstream`.
    *  This will pull in all the changes from the remote ddq-backend-mock repo master branch.
3. Run `git merge upstream/master`.
    *  This will merge the changes into master branch.
4. Checkout your feature branch.
5. Merge master into your branch. `git merge master <branch name>`
    * If everything merges in fine then you're good to create a Pull Request, otherwise fix merge conflicts or other issues.
6. We suggest squashing commits, if able, and creating a Pull Request on GitHub, but this has been problematic when merge conflicts have been present. The other way is to create a patch. Follow the instructions below to create a patch.
    1. Commit all code on feature branch.
    2. git diff master..HEAD > all-the-things.diff
    3. git checkout master
    4. git checkout -b all-the-things
    5. patch -p1 < all-the-things.diff
    6. git add --patch
    7. git commit
    8. git push -u origin all-the-things
    9. Now you can create the Pull Request on GitHub.

Once the Pull Request is accepted you'll want to merge this into your branches to make sure your history is in sync with upstream.