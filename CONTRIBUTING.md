Contributing
============

A guide to contributing for DDQ Backend Mock.

1. Fork the repo. There is a very simple way of doing this on [GitHub](https://help.github.com/articles/fork-a-repo/).
    * Following steps may not be needed if forked properly, but in case you can't get to the upstream server.
        1. Configure the upstream server by running `git remote add upstream <repo address>` or editing your `.git/config` under `[remote "upstream"]`, changing `url`.
2. Create a branch off master `git checkout -b <branch name>`. You don't want to do any work off master as this is where you will pull in upstream changes and merge them into your branches. Also is a good idea to push this remotely `git push -u origin <branch name>`.
3. Write your code on a **feature branch**, you don't want to be working on master as this makes things complicated when merging and issuing pull requests. Be sure to follow the [Tests-Always-Included Style Guide](https://tests-always-included.github.io/style-guide/)
4. Before creating a pull request, it's a good idea to pull in the [upstream changes](https://help.github.com/articles/merging-an-upstream-repository-into-your-fork/), just in case someone has created a pull request before you and it has been merged in.
5. Once you are ready, you can issue your own [pull request](https://help.github.com/articles/about-pull-requests/).